# data-ingestion/fetch_team_logos.py

import os
import requests
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import time
import logging
from urllib.parse import quote # Para codificar nombres de equipo en URL

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Cargar variables de entorno
load_dotenv()
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')
FDO_API_KEY = os.getenv('FOOTBALL_DATA_KEY')
TSDB_API_KEY = os.getenv('THESPORTSDB_KEY') 

# Verificar variables esenciales
if not MONGO_URI or not DB_NAME or not FDO_API_KEY:
    logging.error("Error: MONGO_URI, DB_NAME o FOOTBALL_DATA_KEY no encontrados en .env")
    exit()
if TSDB_API_KEY == '1':
    logging.warning("Usando clave pública '1' para TheSportsDB. Funcionalidad podría ser limitada.")

# --- Configuración API ---
FDO_API_URL = 'https://api.football-data.org/v4'
FDO_HEADERS = { 'X-Auth-Token': FDO_API_KEY }
TSDB_API_URL = f'https://www.thesportsdb.com/api/v1/json/{TSDB_API_KEY}'

# Otros parámetros
PROCESS_BATCH_SIZE = 50 # Cuántos equipos intentar actualizar por ejecución
UPDATE_THRESHOLD_DAYS = 30 # Volver a buscar logo si tiene más de X días

# --- Conexión a MongoDB ---
client = None
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=30000)
    db = client[DB_NAME]
    matches_collection = db['matches']
    team_details_collection = db['team_details'] # Nueva colección para detalles de equipo
    client.admin.command('ping')
    logging.info("MongoDB conectado exitosamente!")
except Exception as e:
    logging.error(f"Error conectando a MongoDB: {e}")
    if client: client.close()
    exit()

# --- Función para obtener equipos que necesitan actualización (CORREGIDA) ---
def get_teams_to_update(batch_size):
    """Obtiene una lista de equipos únicos de 'matches' que faltan o están desactualizados en 'team_details'."""
    logging.info("Buscando equipos únicos en la colección 'matches'...")
    all_teams = []
    try:
        # Usar aggregate para obtener equipos únicos de home y away
        pipeline = [
            # Filtrar documentos donde los IDs de equipo existan
            {'$match': {'teams.home.apiTeamId': {'$type': "number"}, 'teams.away.apiTeamId': {'$type': "number"}, 'sport': {'$in': ['Football', 'Basketball']}}},
            {'$project': {
                'teams': [
                    {'apiTeamId': '$teams.home.apiTeamId', 'name': '$teams.home.name', 'sport': '$sport'},
                    {'apiTeamId': '$teams.away.apiTeamId', 'name': '$teams.away.name', 'sport': '$sport'}
                ]
            }},
            {'$unwind': '$teams'}, # Desanidar el array de equipos
            {'$group': { # Agrupar para obtener equipos únicos por ID y Deporte
                '_id': {
                    'apiTeamId': '$teams.apiTeamId',
                    'sport': '$teams.sport'
                },
                # Tomar el primer nombre encontrado (puede variar si un equipo cambia de nombre en la API)
                'name': {'$first': '$teams.name'}
            }},
            {'$project': { # Reformatear salida
                '_id': 0,
                'apiTeamId': '$_id.apiTeamId',
                'sport': '$_id.sport',
                'name': '$name' # Usar el nombre obtenido
            }}
        ]
        all_teams = list(matches_collection.aggregate(pipeline))
        logging.info(f"Encontrados {len(all_teams)} equipos únicos en 'matches'.")

    except Exception as e:
        logging.error(f"Error obteniendo equipos únicos de 'matches': {e}")
        return [] # Devolver lista vacía si hay error

    if not all_teams:
        logging.info("No se encontraron equipos en la colección 'matches' para procesar.")
        return []

    # Obtener equipos ya existentes en team_details
    existing_teams = {}
    try:
        # Obtener solo los campos necesarios
        existing_teams_cursor = team_details_collection.find({}, {'apiTeamId': 1, 'sport': 1, 'lastUpdated': 1, '_id': 0})
        # Crear diccionario: (apiTeamId, sport) -> lastUpdated (datetime object or None)
        existing_teams = {(t['apiTeamId'], t['sport']): t.get('lastUpdated') for t in existing_teams_cursor if 'apiTeamId' in t and 'sport' in t}
        logging.info(f"Encontrados {len(existing_teams)} equipos en 'team_details'.")
    except Exception as e:
        logging.error(f"Error obteniendo equipos de 'team_details': {e}")
        # Continuar sin datos existentes, se intentarán actualizar todos los equipos encontrados

    # Determinar qué equipos necesitan actualización
    teams_to_update = []
    # Asegurarse de que la fecha umbral sea 'aware' (UTC)
    update_threshold_date = datetime.now(timezone.utc) - timedelta(days=UPDATE_THRESHOLD_DAYS)
    logging.debug(f"DEBUG: Fecha umbral para actualización (UTC): {update_threshold_date}")

    for team in all_teams:
        # Asegurarse de que tenemos la info necesaria del equipo de 'matches'
        if not isinstance(team.get('apiTeamId'), int) or not team.get('sport'):
             logging.warning(f"Equipo inválido encontrado en 'matches' aggregation: {team}. Saltando.")
             continue

        team_key = (team['apiTeamId'], team['sport'])
        last_updated = existing_teams.get(team_key) # Puede ser None, aware datetime, o naive datetime

        needs_update = False
        if last_updated is None:
            # Si no existe en team_details, necesita crearse/actualizarse
            needs_update = True
            logging.debug(f"DEBUG: Equipo {team_key} necesita update (registro no existe en team_details).")
        elif isinstance(last_updated, datetime):
            # Si existe y es un datetime, comprobar si es naive o aware
            if last_updated.tzinfo is None or last_updated.tzinfo.utcoffset(last_updated) is None:
                # Es Naive! Hay que actualizarlo para corregirlo.
                logging.warning(f"DEBUG: Equipo {team_key} tiene fecha 'naive' ({last_updated}). Marcando para actualizar.")
                needs_update = True
            else:
                # Es Aware! Ahora sí podemos comparar con la fecha umbral (que también es aware)
                if last_updated < update_threshold_date:
                    needs_update = True
                    logging.debug(f"DEBUG: Equipo {team_key} necesita update (fecha antigua: {last_updated} < {update_threshold_date}).")
                # else: # Opcional: Log para saber cuáles NO se actualizan
                #    logging.debug(f"DEBUG: Equipo {team_key} está actualizado ({last_updated} >= {update_threshold_date}).")
        else:
            # El campo lastUpdated no es ni None ni datetime, algo raro pasó. Actualizar por si acaso.
            logging.warning(f"DEBUG: Equipo {team_key} tiene tipo inesperado para lastUpdated: {type(last_updated)}. Marcando para actualizar.")
            needs_update = True

        if needs_update:
            # Añadir el nombre obtenido de 'matches' para pasarlo a las funciones de fetch/update
            teams_to_update.append({'apiTeamId': team['apiTeamId'], 'sport': team['sport'], 'name': team.get('name', 'Unknown')})

    logging.info(f"Se necesitan actualizar logos para {len(teams_to_update)} equipos.")
    # Devolver solo un batch limitado por PROCESS_BATCH_SIZE
    return teams_to_update[:batch_size]

# --- Función para obtener logo de Fútbol (Football-Data.org) ---
def fetch_football_logo(team_id):
    """Obtiene la URL del escudo de un equipo desde football-data.org."""
    url = f"{FDO_API_URL}/teams/{team_id}"
    logging.info(f"Consultando FDO API /teams/{team_id}")
    try:
        response = requests.get(url, headers=FDO_HEADERS, timeout=15)
        response.raise_for_status()
        data = response.json()
        crest_url = data.get('crest')
        if crest_url:
            logging.info(f"Logo FDO encontrado para {team_id}")
            return crest_url
        else:
            logging.warning(f"No se encontró 'crest' en la respuesta FDO para {team_id}")
            return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Error API FDO /teams/{team_id}: {e}")
        status_code = e.response.status_code if hasattr(e, 'response') and e.response is not None else 'N/A'
        if status_code == 404:
             logging.warning(f"Equipo FDO {team_id} no encontrado (404).")
        elif status_code == 403:
             logging.error("Error 403 FDO: Verifica tu clave API.")
        elif status_code == 429:
             logging.warning("Límite de tasa FDO alcanzado (429).")
             # Podríamos reintentar o esperar más tiempo, por ahora retornamos None
        return None
    except Exception as e:
        logging.error(f"Error inesperado procesando FDO /teams/{team_id}: {e}")
        return None

# --- Función para obtener logo de Básquetbol (TheSportsDB) ---
def fetch_basketball_logo(team_name):
    """Obtiene la URL del logo de un equipo desde TheSportsDB por nombre."""
    if not team_name: return None
    # Codificar nombre para la URL
    encoded_name = quote(team_name)
    url = f"{TSDB_API_URL}/searchteams.php?t={encoded_name}"
    logging.info(f"Consultando TSDB API /searchteams.php?t={team_name}")
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
        teams = data.get('teams') # La respuesta es una lista de equipos

        if teams and isinstance(teams, list):
            # A veces la búsqueda devuelve varios equipos, intentamos encontrar el correcto
            # Podríamos hacer una comparación más inteligente si fuera necesario
            # Por ahora, tomamos el primero si el nombre coincide razonablemente
            for team_data in teams:
                # Comparación simple (podría mejorarse)
                if team_data and team_name.lower() in team_data.get('strTeam', '').lower() and team_data.get('strSport') == 'Basketball':
                     logo_url = team_data.get('strBadge')
                     if logo_url:
                         logging.info(f"Logo TSDB encontrado para {team_name}")
                         return logo_url
            logging.warning(f"No se encontró logo o equipo de Basketball exacto para '{team_name}' en la respuesta de TSDB.")
            return None
        else:
            logging.warning(f"No se encontraron equipos para '{team_name}' en la respuesta de TSDB.")
            return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Error API TSDB /searchteams.php?t={team_name}: {e}")
        return None
    except Exception as e:
        logging.error(f"Error inesperado procesando TSDB /searchteams.php?t={team_name}: {e}")
        return None

# --- Función para preparar la operación de actualización en BD ---
def prepare_team_update_op(api_team_id, sport, name, logo_url):
    """Prepara una operación UpdateOne para la colección team_details."""
    if not logo_url: # No actualizar si no encontramos logo
        return None

    filter_query = {'apiTeamId': api_team_id, 'sport': sport}
    update_payload = {
        '$set': {
            'name': name,
            'logoUrl': logo_url,
            'lastUpdated': datetime.now(timezone.utc)
        },
        '$setOnInsert': { # Establecer solo al crear el documento
             'apiTeamId': api_team_id,
             'sport': sport,
             'createdAt': datetime.now(timezone.utc)
        }
    }
    return UpdateOne(filter_query, update_payload, upsert=True)

# --- Bucle Principal de Ejecución ---
if __name__ == "__main__":
    logging.info(f"--- Iniciando Fetch de Logos de Equipos ({datetime.now()}) ---")
    start_time = time.time()
    db_operations = []
    fdo_api_calls = 0
    tsdb_api_calls = 0

    # 1. Obtener equipos que necesitan actualizar logo
    teams_to_process = get_teams_to_update(PROCESS_BATCH_SIZE)
    logging.info(f"Se procesarán hasta {PROCESS_BATCH_SIZE} equipos en esta ejecución.")

    # 2. Iterar y obtener logos
    for team_info in teams_to_process:
        api_id = team_info['apiTeamId']
        sport = team_info['sport']
        name = team_info['name']
        logo = None

        if sport == 'Football':
            # Respetar límite FDO (10/min)
            if fdo_api_calls > 0 and fdo_api_calls % 9 == 0:
                 logging.warning("Pausando por 61 segundos para respetar límite FDO...")
                 time.sleep(61)
            logo = fetch_football_logo(api_id)
            fdo_api_calls += 1
        elif sport == 'Basketball':
            # Respetar límite TSDB (aprox 1/sec)
            if tsdb_api_calls > 0:
                 time.sleep(1.1) # Pausa antes de cada llamada TSDB
            logo = fetch_basketball_logo(name)
            tsdb_api_calls += 1

        # 3. Preparar operación de BD si se encontró logo
        if logo:
            update_op = prepare_team_update_op(api_id, sport, name, logo)
            if update_op:
                db_operations.append(update_op)

    # 4. Ejecutar Bulk Write para team_details
    if db_operations:
        logging.info(f"Preparando bulk write con {len(db_operations)} operaciones para team_details...")
        try:
            result = team_details_collection.bulk_write(db_operations, ordered=False)
            logging.info(f"Resultado Bulk write TeamDetails: Inserted={result.inserted_count}, Matched={result.matched_count}, Modified={result.modified_count}, Upserted={result.upserted_count}")
            if result.bulk_api_result.get('writeErrors'): logging.error(f"Errores Bulk write TeamDetails: {result.bulk_api_result['writeErrors']}")
        except Exception as e:
            logging.error(f"Error durante bulk write TeamDetails a MongoDB: {e}")
    else:
        logging.info("No hay operaciones válidas para actualizar/insertar en team_details.")

    # --- Finalización ---
    end_time = time.time()
    logging.info(f"--- Fetch de Logos Finalizado ({datetime.now()}) ---")
    logging.info(f"Tiempo total de ejecución: {end_time - start_time:.2f} segundos")
    logging.info(f"Llamadas API FDO: {fdo_api_calls}, Llamadas API TSDB: {tsdb_api_calls}")

    if client: client.close(); logging.info("Conexión MongoDB cerrada.")