import os
import requests
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime, timedelta
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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

API_BASE_URL = 'https://api.football-data.org/v4'
HEADERS = { 'X-Auth-Token': API_KEY }

TARGET_COMPETITIONS = [
    2021,
    2014,
    2002,
    2019,
    2015,
    2001
]

MAX_DAYS_RANGE = 9
try:
    overall_start_date = datetime.now() - timedelta(days=5)
    overall_end_date = datetime.now() + timedelta(days=14)
    logging.info(f"Rango total a cubrir: {overall_start_date.strftime('%Y-%m-%d')} hasta {overall_end_date.strftime('%Y-%m-%d')}")
except Exception as e:
    logging.error(f"Error calculando rango total de fechas: {e}")
    exit()

client = None
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=30000)
    db = client[DB_NAME]
    matches_collection = db['matches']
    client.admin.command('ping')
    logging.info("MongoDB conectado exitosamente!")
except Exception as e:
    logging.error(f"Error conectando a MongoDB: {e}")
    if client:
        client.close()
    exit()

def fetch_fdo_matches(competition_id, date_from, date_to):
    url = f"{API_BASE_URL}/matches"
    params = {
        "dateFrom": date_from,
        "dateTo": date_to,
        "competitions": competition_id
    }
    logging.info(f"Llamando API: Competición={competition_id}, Fechas={date_from} a {date_to}")
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=30)
        remaining_requests = response.headers.get('X-Requests-Available-Minute')
        if remaining_requests:
            logging.info(f"Requests disponibles este minuto: {remaining_requests}")
        response.raise_for_status()
        data = response.json()
        matches_data = data.get('matches', [])
        api_errors = data.get('errors')
        if api_errors:
            logging.error(f"Errores API para Competición {competition_id}: {api_errors}")
            return []
        if isinstance(matches_data, list) and len(matches_data) > 0:
            match_count_real = len(matches_data)
            logging.info(f"API OK: {match_count_real} partidos encontrados y procesados para Competición {competition_id}")
            return matches_data
        else:
            logging.info(f"No se encontraron partidos válidos en la respuesta para Competición {competition_id}")
            return []
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
    except Exception as e:
        logging.error(f"Error inesperado procesando respuesta API para Competición {competition_id}: {e}")
        return []

def process_and_save_fdo_matches(matches_data):
    operations = []
    processed_ids = set()
    for match_info in matches_data:
        match_id = match_info.get('id')
        if not match_id or match_id in processed_ids:
            logging.warning(f"Match ID inválido o duplicado, saltando: {match_id}")
            continue
        processed_ids.add(match_id)
        try:
            if not all(match_info.get(k) for k in ('competition', 'season', 'utcDate', 'status', 'homeTeam', 'awayTeam', 'score')):
                 logging.warning(f"Datos incompletos para Match ID {match_id}. Saltando.")
                 continue
            if not match_info['homeTeam'].get('id') or not match_info['awayTeam'].get('id') or not match_info['competition'].get('id'):
                 logging.warning(f"Faltan IDs de equipo o competición para Match ID {match_id}. Saltando.")
                 continue
            api_status = match_info['status']
            status_map = {'SCHEDULED': 'scheduled', 'TIMED': 'scheduled', 'IN_PLAY': 'inprogress',
                          'PAUSED': 'inprogress', 'FINISHED': 'finished', 'POSTPONED': 'postponed',
                          'SUSPENDED': 'postponed', 'CANCELLED': 'cancelled'}
            match_status = status_map.get(api_status, api_status.lower())
            season_year = 'Unknown'
            if isinstance(match_info.get('season'), dict) and match_info['season'].get('startDate'):
                 try:
                     season_year = str(datetime.strptime(match_info['season']['startDate'], '%Y-%m-%d').year)
                 except ValueError:
                     logging.warning(f"Formato de fecha de temporada inesperado para Match ID {match_id}: {match_info['season'].get('startDate')}")
            elif isinstance(match_info.get('season'), dict) and isinstance(match_info['season'].get('id'), int):
                 if 2000 < match_info['season']['id'] < 2100:
                      season_year = str(match_info['season']['id'])
            home_score = None
            away_score = None
            if isinstance(match_info['score'].get('fullTime'), dict):
                 home_score = match_info['score']['fullTime'].get('home')
                 away_score = match_info['score']['fullTime'].get('away')
            match_doc = {
                'sport': 'Football',
                'matchDate': datetime.strptime(match_info['utcDate'], '%Y-%m-%dT%H:%M:%SZ'),
                'status': match_status,
                'apiFootballDataOrgMatchId': match_id,
                'league': {
                    'apiLeagueId': match_info['competition']['id'],
                    'name': match_info['competition'].get('name', 'Unknown'),
                    'season': season_year
                },
                'teams': {
                    'home': {
                        'apiTeamId': match_info['homeTeam']['id'],
                        'name': match_info['homeTeam'].get('name', 'Unknown')
                    },
                    'away': {
                        'apiTeamId': match_info['awayTeam']['id'],
                        'name': match_info['awayTeam'].get('name', 'Unknown')
                    }
                },
                'scores': {k: v for k, v in {'home': home_score, 'away': away_score}.items() if isinstance(v, (int, float))}
            }
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
            logging.error(f"Error procesando Match ID {match_id} de football-data.org: {e}", exc_info=True)
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

if _name_ == "_main_":
    logging.info(f"--- Iniciando Fetch de Partidos de Fútbol (Football-Data.org) ({datetime.now()}) ---")
    start_time = time.time()
    all_matches_data = []
    api_call_count = 0
    for competition_id in TARGET_COMPETITIONS:
        logging.info(f"--- Iniciando fetch para Competición: {competition_id} ---")
        current_chunk_start_date = overall_start_date
        while current_chunk_start_date <= overall_end_date:
            chunk_end_date = current_chunk_start_date + timedelta(days=MAX_DAYS_RANGE)
            if chunk_end_date > overall_end_date:
                chunk_end_date = overall_end_date
            date_from_str = current_chunk_start_date.strftime('%Y-%m-%d')
            date_to_str = chunk_end_date.strftime('%Y-%m-%d')
            if api_call_count > 0 :
                wait_time = 6.1
                logging.info(f"Esperando {wait_time:.1f} segundos antes de la siguiente llamada API...")
                time.sleep(wait_time)
            matches = fetch_fdo_matches(competition_id, date_from_str, date_to_str)
            api_call_count += 1
            if matches:
                all_matches_data.extend(matches)
            current_chunk_start_date = chunk_end_date + timedelta(days=1)
        logging.info(f"--- Finalizado fetch para Competición: {competition_id} ---")
    if all_matches_data:
        unique_matches_dict = {}
        for match in all_matches_data:
             if isinstance(match, dict) and 'id' in match:
                  unique_matches_dict[match['id']] = match
             else:
                  logging.warning(f"Item inesperado en all_matches_data, no es un diccionario con 'id': {match}")
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