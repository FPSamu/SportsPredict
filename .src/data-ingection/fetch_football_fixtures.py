import os
import requests
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
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

MAX_DAYS_RANGE_API = 9
try:
    current_system_time = datetime.now()
    overall_start_date = current_system_time - timedelta(days=5)
    overall_end_date = current_system_time + timedelta(days=14)
    logging.info(f"FDO: Rango total a cubrir: {overall_start_date.strftime('%Y-%m-%d')} hasta {overall_end_date.strftime('%Y-%m-%d')}")
except Exception as e:
    logging.error(f"FDO: Error calculando rango total de fechas: {e}")
    exit()

client = None
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=30000)
    db = client[DB_NAME]
    matches_collection = db['matches']
    client.admin.command('ping')
    logging.info("FDO: MongoDB conectado exitosamente!")
except Exception as e:
    logging.error(f"FDO: Error conectando a MongoDB: {e}")
    if client: client.close()
    exit()

def fetch_fdo_matches(competition_id, date_from_str, date_to_str):
    url = f"{API_BASE_URL}/matches"
    params = {
        "dateFrom": date_from_str,
        "dateTo": date_to_str,
        "competitions": competition_id
    }
    logging.info(f"FDO: Llamando API: Competición={competition_id}, Fechas={date_from_str} a {date_to_str}")
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=20)
        remaining_requests = response.headers.get('X-Requests-Available-Minute')
        if remaining_requests:
            logging.info(f"FDO: Requests disponibles este minuto: {remaining_requests}")
        response.raise_for_status()
        data = response.json()
        api_errors = data.get('errors')
        if api_errors:
             logging.error(f"FDO: Errores API para Competición {competition_id}: {api_errors}")
             return []
        matches_data = data.get('matches', [])
        match_count = data.get('count', len(matches_data))
        if match_count == 0 or not matches_data:
             logging.info(f"FDO: No se encontraron partidos para Competición {competition_id} en este chunk.")
             return []
        logging.info(f"FDO API OK: {match_count} partidos encontrados para Competición {competition_id} en este chunk.")
        return matches_data
    except requests.exceptions.HTTPError as e:
        logging.error(f"FDO: Error HTTP para Competición {competition_id}: {e.response.status_code} - {e.response.text[:200]}")
        if e.response.status_code == 429:
            logging.warning("FDO: Límite de tasa alcanzado (429). Esperando 65 segundos...")
            time.sleep(65)
        return []
    except requests.exceptions.RequestException as e:
        logging.error(f"FDO: Error de conexión API para Competición {competition_id}: {e}")
        return []
    except Exception as e:
        logging.error(f"FDO: Error inesperado procesando respuesta API para Competición {competition_id}: {e}")
        return []

def process_and_save_fdo_matches(matches_data):
    operations = []
    processed_ids = set()
    for match_info in matches_data:
        match_id = match_info.get('id')
        if not match_id or match_id in processed_ids: continue
        processed_ids.add(match_id)
        try:
            if not all(match_info.get(k) for k in ('competition', 'season', 'utcDate', 'status', 'homeTeam', 'awayTeam', 'score')):
                 logging.warning(f"FDO: Datos incompletos para Match ID {match_id}. Saltando.")
                 continue
            if not match_info['homeTeam'].get('id') or not match_info['awayTeam'].get('id') or not match_info['competition'].get('id'):
                 logging.warning(f"FDO: Faltan IDs de equipo/competición para Match ID {match_id}. Saltando.")
                 continue

            api_status = match_info['status']
            status_map = {'SCHEDULED': 'scheduled', 'TIMED': 'scheduled', 'IN_PLAY': 'inprogress',
                          'PAUSED': 'inprogress', 'FINISHED': 'finished', 'POSTPONED': 'postponed',
                          'SUSPENDED': 'postponed', 'CANCELLED': 'cancelled'}
            match_status = status_map.get(api_status, api_status.lower())
            season_year = str(match_info['season']['startDate'][:4]) if match_info.get('season') and match_info['season'].get('startDate') else 'Unknown'
            
            home_score, away_score = None, None
            if isinstance(match_info['score'].get('fullTime'), dict):
                 home_score = match_info['score']['fullTime'].get('home')
                 away_score = match_info['score']['fullTime'].get('away')

            match_doc = {
                'sport': 'Football',
                'matchDate': datetime.strptime(match_info['utcDate'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc),
                'status': match_status,
                'apiFootballDataOrgMatchId': match_id,
                'league': {'apiLeagueId': match_info['competition']['id'], 'name': match_info['competition'].get('name', 'Unknown'), 'season': season_year},
                'teams': {
                    'home': {'apiTeamId': match_info['homeTeam']['id'], 'name': match_info['homeTeam'].get('name', 'Unknown')},
                    'away': {'apiTeamId': match_info['awayTeam']['id'], 'name': match_info['awayTeam'].get('name', 'Unknown')}
                },
                'scores': {k: v for k, v in {'home': home_score, 'away': away_score}.items() if isinstance(v, (int, float))}
            }
            if not match_doc['scores']: del match_doc['scores']
            operations.append(UpdateOne({'apiFootballDataOrgMatchId': match_id}, {'$set': match_doc, '$setOnInsert': {'createdAt': datetime.now(timezone.utc)}}, upsert=True))
        except Exception as e:
            logging.error(f"FDO: Error procesando Match ID {match_id}: {e}", exc_info=True)

    if operations:
        logging.info(f"FDO: Preparando bulk write con {len(operations)} operaciones...")
        try:
            result = matches_collection.bulk_write(operations, ordered=False)
            logging.info(f"FDO: Resultado Bulk write: Inserted={result.inserted_count}, Matched={result.matched_count}, Modified={result.modified_count}, Upserted={result.upserted_count}")
            if result.bulk_api_result.get('writeErrors'): logging.error(f"FDO: Errores Bulk write: {result.bulk_api_result['writeErrors']}")
        except Exception as e: logging.error(f"FDO: Error durante bulk write a MongoDB: {e}")
    else: logging.info("FDO: No hay operaciones válidas para BD.")

if __name__ == "__main__":
    logging.info(f"--- Iniciando Fetch de Partidos de Fútbol (Football-Data.org) ({datetime.now()}) ---")
    start_time = time.time()
    all_matches_data = []
    api_call_count = 0

    for competition_id in TARGET_COMPETITIONS:
        logging.info(f"--- FDO: Iniciando fetch para Competición: {competition_id} ---")
        current_chunk_start_date = overall_start_date
        while current_chunk_start_date <= overall_end_date:
            chunk_end_date = current_chunk_start_date + timedelta(days=MAX_DAYS_RANGE_API)
            if chunk_end_date > overall_end_date: chunk_end_date = overall_end_date
            date_from_str = current_chunk_start_date.strftime('%Y-%m-%d')
            date_to_str = chunk_end_date.strftime('%Y-%m-%d')

            if api_call_count > 0 :
                wait_time = 6.1
                logging.info(f"FDO: Esperando {wait_time:.1f}s antes de la siguiente llamada API...")
                time.sleep(wait_time)
            
            matches = fetch_fdo_matches(competition_id, date_from_str, date_to_str)
            api_call_count += 1
            if matches: all_matches_data.extend(matches)
            
            current_chunk_start_date = chunk_end_date + timedelta(days=1)
            if current_chunk_start_date > overall_end_date and competition_id != TARGET_COMPETITIONS[-1]:
                 pass
        logging.info(f"--- FDO: Finalizado fetch para Competición: {competition_id} ---")

    if all_matches_data:
        unique_matches_dict = {match['id']: match for match in all_matches_data if isinstance(match, dict) and 'id' in match}
        unique_matches_list = list(unique_matches_dict.values())
        logging.info(f"FDO: Procesando {len(unique_matches_list)} partidos únicos...")
        process_and_save_fdo_matches(unique_matches_list)
    else: logging.info("FDO: No se obtuvieron datos de partidos en esta ejecución.")

    end_time = time.time()
    logging.info(f"--- Fetch de Partidos de Fútbol (FDO) Finalizado. Duración: {end_time - start_time:.2f}s, Llamadas API: {api_call_count} ---")
    if client: client.close(); logging.info("FDO: Conexión MongoDB cerrada.")
