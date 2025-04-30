# data-ingestion/fetch_football_fixtures_fdo.py

import os
import requests
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime, timedelta
import time
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Cargar variables de entorno (.env en esta carpeta)
load_dotenv()
API_KEY = os.getenv('FOOTBALL_DATA_KEY')
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')

if not API_KEY:
    logging.error("Error: La clave API FOOTBALL_DATA_KEY no se encontró en el archivo .env")
    exit()
if not MONGO_URI:
    logging.error("Error: La URI de MongoDB MONGO_URI no se encontró en el archivo .env")
    exit()
if not DB_NAME:
    logging.error("Error: El nombre de la BD DB_NAME no se encontró en el archivo .env")
    exit()


# --- Configuración ---
API_BASE_URL = 'https://api.football-data.org/v4/'
HEADERS = { 'X-Auth-Token': API_KEY }

# <<< IMPORTANTE: Verifica estos IDs Numéricos con la API /v4/competitions >>>
# IDs comunes: PL=2021, La Liga=2014, CL=2001, Bundesliga=2002, Serie A=2019, Ligue 1=2015
# TARGET_COMPETITIONS = [2021, 2014, 2001] # Ejemplo: Premier League, La Liga, Champions League
TARGET_COMPETITIONS = [2021] # Prueba solo con uno primero si quieres

# Rango de fechas Amplio para Prueba
try:
    DATE_FROM = '2025-03-01'
    DATE_TO = '2025-05-15'
    logging.info(f"Buscando partidos desde {DATE_FROM} hasta {DATE_TO}")
except Exception as e:
    logging.error(f"Error calculando fechas: {e}")
    exit()

# --- Conexión a MongoDB ---
client = None
try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    matches_collection = db['matches']
    client.admin.command('ping')
    logging.info("MongoDB conectado exitosamente!")
except Exception as e:
    logging.error(f"Error conectando a MongoDB: {e}")
    if client:
        client.close()
    exit()

# --- Función para llamar a la API ---
# --- Función para llamar a la API (CORREGIDA) ---
def fetch_fdo_matches(competition_id, date_from, date_to):
    """Obtiene partidos de football-data.org para una competición y rango de fechas usando el endpoint /matches."""
    url = f"{API_BASE_URL}/matches"
    params = {
        "dateFrom": date_from,
        "dateTo": date_to,
        "competitions": competition_id
    }
    logging.info(f"Llamando API: Competición={competition_id}, Fechas={date_from} a {date_to}")
    try:
        # --- Añadimos los DEBUG logs para verificar la petición ---
        logging.debug(f"DEBUG: Enviando petición a URL: {url}")
        logging.debug(f"DEBUG: Headers enviados: {HEADERS}")
        logging.debug(f"DEBUG: Params enviados: {params}")
        # --- Fin DEBUG petición ---

        response = requests.get(url, headers=HEADERS, params=params, timeout=20)

        # --- Añadimos los DEBUG logs para verificar la respuesta ---
        logging.debug(f"DEBUG: Código de Estado Recibido: {response.status_code}")
        logging.debug(f"DEBUG: Texto Crudo Recibido (primeros 500 chars): {response.text[:500]}...")
        # --- Fin DEBUG respuesta ---

        remaining_requests = response.headers.get('X-Requests-Available-Minute')
        if remaining_requests:
            logging.info(f"Requests disponibles este minuto: {remaining_requests}")

        response.raise_for_status() # Verifica errores HTTP (4xx, 5xx)
        data = response.json()

        matches_data = data.get('matches', [])
        api_errors = data.get('errors') # Verificar errores específicos de la API

        # <<< --- LÓGICA DE COMPROBACIÓN CORREGIDA --- >>>
        if api_errors:
            logging.error(f"Errores API para Competición {competition_id}: {api_errors}")
            return [] # Devolver vacío si la API reporta errores

        # Comprobar positivamente si tenemos una lista válida de partidos
        if isinstance(matches_data, list) and len(matches_data) > 0:
            # ¡Éxito! Tenemos partidos
            match_count_real = len(matches_data) # Usar longitud real de la lista
            logging.info(f"API OK: {match_count_real} partidos encontrados y procesados para Competición {competition_id}")
            return matches_data # Devolver la lista de partidos
        else:
            # No se encontraron partidos válidos en la respuesta
            logging.info(f"No se encontraron partidos válidos en la respuesta para Competición {competition_id}")
            return []
        # <<< --- FIN DE LÓGICA CORREGIDA --- >>>

    except requests.exceptions.Timeout:
        logging.error(f"Timeout en la llamada API para Competición {competition_id}")
        return []
    except requests.exceptions.HTTPError as e:
        logging.error(f"Error HTTP en la llamada API para Competición {competition_id}: {e}")
        status_code = e.response.status_code
        response_text = e.response.text
        logging.error(f"Response Status: {status_code}, Response Text: {response_text[:500]}...")
        if status_code == 404:
             logging.error(f"Error 404: Verifica si el ID de Competición '{competition_id}' es correcto o si tienes acceso a él.")
        elif status_code == 403:
             logging.error("Error 403: Forbidden. Verifica tu API Key o los permisos de tu plan.")
        elif status_code == 429:
            logging.warning("Límite de tasa alcanzado (429). Esperando 65 segundos...")
            time.sleep(65)
            return []
        return []
    except requests.exceptions.RequestException as e:
         logging.error(f"Error de conexión API para Competición {competition_id}: {e}")
         return []
    except Exception as e: # Captura errores al parsear JSON también
        logging.error(f"Error inesperado procesando respuesta API para Competición {competition_id}: {e}")
        return []

# --- Función para procesar y guardar en BD (sin cambios respecto a la versión anterior) ---
def process_and_save_fdo_matches(matches_data):
    """Procesa partidos de football-data.org y los guarda/actualiza en MongoDB."""
    operations = []
    processed_ids = set()

    for match_info in matches_data:
        match_id = match_info.get('id')
        if not match_id or match_id in processed_ids:
            logging.warning(f"Match ID inválido o duplicado, saltando: {match_id}")
            continue
        processed_ids.add(match_id)

        try:
            if not all(k in match_info for k in ('competition', 'season', 'utcDate', 'status', 'homeTeam', 'awayTeam', 'score')):
                 logging.warning(f"Datos incompletos para Match ID {match_id}. Saltando.")
                 continue

            api_status = match_info['status']
            status_map = {'SCHEDULED': 'scheduled', 'TIMED': 'scheduled', 'IN_PLAY': 'inprogress',
                          'PAUSED': 'inprogress', 'FINISHED': 'finished', 'POSTPONED': 'postponed',
                          'SUSPENDED': 'postponed', 'CANCELLED': 'cancelled'}
            match_status = status_map.get(api_status, api_status.lower())

            # Extraer año de inicio de temporada
            season_year = str(match_info['season']['startDate'][:4]) if match_info.get('season') and match_info['season'].get('startDate') else 'Unknown'

            match_doc = {
                'sport': 'Football',
                'matchDate': datetime.strptime(match_info['utcDate'], '%Y-%m-%dT%H:%M:%SZ'),
                'status': match_status,
                'apiFootballDataOrgMatchId': match_id,
                'league': {
                    'apiLeagueId': match_info['competition']['id'],
                    'name': match_info['competition']['name'],
                    'season': season_year
                },
                'teams': {
                    'home': {
                        'apiTeamId': match_info['homeTeam']['id'],
                        'name': match_info['homeTeam']['name']
                    },
                    'away': {
                        'apiTeamId': match_info['awayTeam']['id'],
                        'name': match_info['awayTeam']['name']
                    }
                },
                'scores': {
                    'home': match_info['score']['fullTime'].get('home'),
                    'away': match_info['score']['fullTime'].get('away')
                }
            }

            match_doc['scores'] = {k: v for k, v in match_doc['scores'].items() if v is not None}
            if not match_doc['scores']:
                del match_doc['scores']

            update_payload = {'$set': match_doc,
                              '$setOnInsert': {'createdAt': datetime.utcnow()}}

            operations.append(
                UpdateOne(
                    {'apiFootballDataOrgMatchId': match_id},
                    update_payload,
                    upsert=True
                )
            )
        except Exception as e:
            logging.error(f"Error procesando Match ID {match_id} de football-data.org: {e}")

    if operations:
        logging.info(f"Preparando bulk write con {len(operations)} operaciones...")
        try:
            result = matches_collection.bulk_write(operations, ordered=False)
            logging.info(f"Resultado Bulk write FDO: Inserted={result.inserted_count}, Matched={result.matched_count}, Modified={result.modified_count}, Upserted={result.upserted_count}")
            if result.bulk_api_result.get('writeErrors'):
                 logging.error(f"Errores durante bulk write FDO: {result.bulk_api_result['writeErrors']}")
        except Exception as e:
            logging.error(f"Error durante bulk write FDO a MongoDB: {e}")
    else:
        logging.info("No hay operaciones FDO válidas para realizar en la BD.")

# --- Bucle Principal ---
# --- (Las importaciones, configuración, conexión a BD y las funciones
# --- fetch_fdo_matches y process_and_save_fdo_matches SE MANTIENEN IGUAL que en la versión anterior) ---

# --- Bucle Principal MODIFICADO ---
if __name__ == "__main__":
    logging.info(f"--- Iniciando Fetch de Partidos de Fútbol (Football-Data.org) ({datetime.now()}) ---")
    start_time = time.time()
    all_matches_data = []
    api_call_count = 0
    MAX_DAYS_RANGE = 9 # Límite de la API es 10, usamos 9 por seguridad

    # Definir el rango total que queremos cubrir (ajusta si es necesario)
    try:
        # Ejemplo: Cubrir desde hace 3 días hasta próximos 14 días
        overall_start_date = datetime.now() - timedelta(days=3)
        overall_end_date = datetime.now() + timedelta(days=14)
        logging.info(f"Rango total a cubrir: {overall_start_date.strftime('%Y-%m-%d')} hasta {overall_end_date.strftime('%Y-%m-%d')}")
    except Exception as e:
        logging.error(f"Error calculando rango total de fechas: {e}")
        if client: client.close()
        exit()

    # Iterar por las competiciones objetivo
    for competition_id in TARGET_COMPETITIONS:
        logging.info(f"--- Iniciando fetch para Competición: {competition_id} ---")
        # Empezar desde la fecha de inicio total para esta competición
        current_chunk_start_date = overall_start_date

        # Iterar por chunks de fechas hasta cubrir el rango total
        while current_chunk_start_date <= overall_end_date:
            # Calcular fecha fin del chunk actual (máx 9 días después)
            chunk_end_date = current_chunk_start_date + timedelta(days=MAX_DAYS_RANGE)
            # Asegurarse de no pasarse de la fecha final total
            if chunk_end_date > overall_end_date:
                chunk_end_date = overall_end_date

            # Formatear fechas para la API
            date_from_str = current_chunk_start_date.strftime('%Y-%m-%d')
            date_to_str = chunk_end_date.strftime('%Y-%m-%d')

            # Aplicar lógica de pausa para respetar límites de tasa (10/min)
            # Esperar ANTES de hacer la llamada (excepto la primera vez)
            if api_call_count > 0 :
                wait_time = 6.1 # Esperar un poco más de 6 segundos (10 llamadas * 6s = 60s)
                logging.info(f"Esperando {wait_time:.1f} segundos antes de la siguiente llamada API...")
                time.sleep(wait_time)

            # Fetch para el chunk actual
            matches = fetch_fdo_matches(competition_id, date_from_str, date_to_str)
            api_call_count += 1 # Incrementar contador DESPUÉS de la llamada
            if matches:
                all_matches_data.extend(matches)

            # Moverse a la fecha de inicio del siguiente chunk
            current_chunk_start_date = chunk_end_date + timedelta(days=1)

        logging.info(f"--- Finalizado fetch para Competición: {competition_id} ---")
        # Podrías añadir una pausa corta aquí si vas a consultar muchas competiciones
        # time.sleep(1)

    # Procesar todos los datos recolectados al final
    if all_matches_data:
        # Eliminar duplicados que la API podría devolver en chunks solapados
        unique_matches_dict = {match['id']: match for match in all_matches_data}
        unique_matches_list = list(unique_matches_dict.values())
        logging.info(f"Procesando un total de {len(unique_matches_list)} partidos únicos obtenidos de FDO API...")
        process_and_save_fdo_matches(unique_matches_list)
    else:
        logging.info("No se obtuvieron datos de partidos FDO en esta ejecución.")

    end_time = time.time()
    logging.info(f"--- Fetch de Partidos de Fútbol (FDO) Finalizado ({datetime.now()}) ---")
    logging.info(f"Tiempo total de ejecución: {end_time - start_time:.2f} segundos")
    logging.info(f"Total llamadas API realizadas: {api_call_count}")

    if client:
        client.close()
        logging.info("Conexión MongoDB cerrada.")