import os
import requests
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')
BDB_API_KEY = os.getenv('BALLDONTLIE_API_KEY')

if not MONGO_URI or not DB_NAME:
    logging.error("Error: MONGO_URI o DB_NAME no encontrados en .env")
    exit()
if not BDB_API_KEY:
    logging.error("Error: BALLDONTLIE_API_KEY no encontrada en .env")
    exit()

API_BASE_URL = 'https://api.balldontlie.io/v1'
BDB_HEADERS = { 'Authorization': BDB_API_KEY }
CURRENT_NBA_SEASON = 2024

try:
    current_system_time = datetime.now()
    overall_start_date = current_system_time - timedelta(days=5)
    overall_end_date = current_system_time + timedelta(days=14)
    logging.info(f"BDL: Buscando partidos NBA desde {overall_start_date.strftime('%Y-%m-%d')} hasta {overall_end_date.strftime('%Y-%m-%d')} para temp. {CURRENT_NBA_SEASON}")
except Exception as e:
    logging.error(f"BDL: Error calculando fechas: {e}")
    exit()

client = None
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=45000, connectTimeoutMS=30000)
    db = client[DB_NAME]
    matches_collection = db['matches']
    client.admin.command('ping')
    logging.info("BDL: MongoDB conectado exitosamente!")
except Exception as e:
    logging.error(f"BDL: Error conectando a MongoDB: {e}")
    if client: client.close()
    exit()

def fetch_bbal_games_for_date(target_date_str, season_year):
    url = f"{API_BASE_URL}/games"
    all_games_for_date = []
    current_page = 1
    fetch_more = True
    while fetch_more:
        params = {
            "dates[]": target_date_str,
            "seasons[]": season_year,
            "page": current_page,
            "per_page": 100
        }
        logging.info(f"BDL: Llamando API /games: Fecha={target_date_str}, Temporada={season_year}, Página={current_page}")
        try:
            response = requests.get(url, headers=BDB_HEADERS, params=params, timeout=25)
            response.raise_for_status()
            data = response.json()
            games = data.get('data', [])
            meta = data.get('meta', {})
            next_page = meta.get('next_page')
            total_count_api = meta.get('total_count', 0)
            logging.info(f"BDL API /games OK: {len(games)} juegos para {target_date_str} en pág {current_page} (Total API: {total_count_api}). Sig. pág: {next_page}")
            if games: all_games_for_date.extend(games)
            if next_page:
                current_page = next_page
                time.sleep(0.6)
            else:
                fetch_more = False
        except requests.exceptions.RequestException as e:
            logging.error(f"BDL: Error API /games (Fecha {target_date_str}, Pág {current_page}): {e}")
            status_code = e.response.status_code if hasattr(e, 'response') and e.response is not None else 'N/A'
            if status_code == 401: logging.error("BDL: Error 401 Unauthorized. Verifica BALLDONTLIE_API_KEY.")
            fetch_more = False
        except Exception as e:
            logging.error(f"BDL: Error inesperado API /games (Fecha {target_date_str}, Pág {current_page}): {e}")
            fetch_more = False
    return all_games_for_date

def process_and_save_bbal_games(games_data):
    operations = []
    processed_ids = set()
    for game_info in games_data:
        game_id = game_info.get('id')
        if not game_id or game_id in processed_ids: continue
        processed_ids.add(game_id)
        try:
            if not all(k in game_info for k in ('date', 'status', 'home_team', 'visitor_team', 'season')) \
               or not isinstance(game_info.get('home_team'), dict) or not game_info['home_team'].get('id') \
               or not isinstance(game_info.get('visitor_team'), dict) or not game_info['visitor_team'].get('id'):
                logging.warning(f"BDL: Datos incompletos Game ID {game_id}. Saltando. Data: {str(game_info)[:200]}")
                continue
            
            match_date_dt = datetime.fromisoformat(game_info['date'].replace('Z', '+00:00'))
            api_status = game_info['status']
            match_status = ''
            if api_status == 'Final': match_status = 'finished'
            elif "Qtr" in api_status or "Halftime" in api_status or "OT" in api_status or api_status.startswith("P"): match_status = 'inprogress'
            elif api_status == 'Scheduled': match_status = 'scheduled'
            elif match_date_dt > datetime.now(timezone.utc) and api_status.lower() not in ['final', 'cancelled', 'postponed', 'ft', 'aot']:
                match_status = 'scheduled'
            else:
                logging.warning(f"BDL: Estado no reconocido '{api_status}' Game ID {game_id} Fecha {match_date_dt}. Usando minúsculas.")
                match_status = api_status.lower()

            match_doc_set = {
                'sport': 'Basketball', 'matchDate': match_date_dt, 'status': match_status,
                'league': {'apiLeagueId': 12, 'name': 'NBA', 'season': str(game_info['season'])},
                'teams': {
                    'home': {'apiTeamId': game_info['home_team']['id'], 'name': game_info['home_team'].get('full_name', 'Unknown')},
                    'away': {'apiTeamId': game_info['visitor_team']['id'], 'name': game_info['visitor_team'].get('full_name', 'Unknown')}
                }
            }
            if api_status == 'Final' or match_status == 'inprogress':
                if game_info.get('home_team_score') is not None and game_info.get('visitor_team_score') is not None:
                     match_doc_set['scores'] = {
                         'home': game_info.get('home_team_score'),
                         'away': game_info.get('visitor_team_score')
                     }
            
            operations.append(UpdateOne(
                {'apiBasketballGameId': game_id},
                {'$set': match_doc_set, '$setOnInsert': {'createdAt': datetime.now(timezone.utc), 'apiBasketballGameId': game_id, 'detailedStatsFetched': False}},
                upsert=True
            ))
        except Exception as e:
            logging.error(f"BDL: Error procesando Game ID {game_id}: {e}", exc_info=True)

    if operations:
        logging.info(f"BDL: Preparando bulk write con {len(operations)} operaciones...")
        try:
            result = matches_collection.bulk_write(operations, ordered=False)
            logging.info(f"BDL: Resultado Bulk write: Inserted={result.inserted_count}, Matched={result.matched_count}, Modified={result.modified_count}, Upserted={result.upserted_count}")
            if result.bulk_api_result.get('writeErrors'): logging.error(f"BDL: Errores Bulk write: {result.bulk_api_result['writeErrors']}")
        except Exception as e: logging.error(f"BDL: Error durante bulk write a MongoDB: {e}")
    else: logging.info("BDL: No hay operaciones válidas para BD.")

if __name__ == "__main__":
    logging.info(f"--- Iniciando Fetch de Partidos de Básquetbol (balldontlie /games) ({datetime.now()}) ---")
    start_time = time.time()
    all_games_list = []
    api_call_count = 0
    current_date_to_fetch = overall_start_date

    while current_date_to_fetch <= overall_end_date:
        target_date_str = current_date_to_fetch.strftime('%Y-%m-%d')
        if api_call_count > 0:
            wait_time = 1.1
            logging.info(f"BDL: Esperando {wait_time:.1f}s antes de la sig. llamada API /games...")
            time.sleep(wait_time)
        
        games_for_day = fetch_bbal_games_for_date(target_date_str, CURRENT_NBA_SEASON)
        api_call_count += 1
        if games_for_day: all_games_list.extend(games_for_day)
        elif games_for_day is None: logging.error(f"BDL: Detenido fetch para {target_date_str} por error API.")
        
        current_date_to_fetch += timedelta(days=1)

    if all_games_list:
        unique_games_dict = {game['id']: game for game in all_games_list if isinstance(game, dict) and 'id' in game}
        unique_games_list = list(unique_games_dict.values())
        logging.info(f"BDL: Procesando {len(unique_games_list)} partidos únicos de API /games...")
        process_and_save_bbal_games(unique_games_list)
    else: logging.info("BDL: No se obtuvieron datos de partidos /games en esta ejecución.")

    end_time = time.time()
    logging.info(f"--- Fetch de Partidos de Básquetbol (BDL /games) Finalizado. Duración: {end_time - start_time:.2f}s, Días procesados: {api_call_count} ---")
    if client: client.close(); logging.info("BDL: Conexión MongoDB cerrada.")
