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
BDB_HEADERS = {
    'Authorization': BDB_API_KEY
}

try:
    current_system_time = datetime.now()
    overall_start_date = current_system_time - timedelta(days=90)
    overall_end_date = current_system_time + timedelta(days=14)
    logging.info(f"Buscando partidos NBA desde {overall_start_date.strftime('%Y-%m-%d')} hasta {overall_end_date.strftime('%Y-%m-%d')}")
except Exception as e:
    logging.error(f"Error calculando fechas: {e}")
    exit()

client = None
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=45000, connectTimeoutMS=30000)
    db = client[DB_NAME]
    matches_collection = db['matches']
    client.admin.command('ping')
    logging.info("MongoDB conectado exitosamente!")
except Exception as e:
    logging.error(f"Error conectando a MongoDB: {e}")
    if client: client.close()
    exit()

def fetch_bbal_games_for_date(target_date_str):
    url = f"{API_BASE_URL}/games"
    all_games_for_date = []
    current_page = 1
    fetch_more = True

    while fetch_more:
        params = {
            "dates[]": target_date_str,
            "page": current_page,
            "per_page": 100
        }
        logging.info(f"Llamando BDL API /games: Fecha={target_date_str}, Página={current_page}")
        try:
            response = requests.get(url, headers=BDB_HEADERS, params=params, timeout=25)
            response.raise_for_status()
            data = response.json()
            games = data.get('data', [])
            meta = data.get('meta', {})
            next_page = meta.get('next_page')

            logging.info(f"BDL API /games OK: {len(games)} juegos encontrados para {target_date_str} en página {current_page}. Siguiente página: {next_page}")
            if games:
                all_games_for_date.extend(games)

            if next_page:
                current_page = next_page
                time.sleep(0.5)
            else:
                fetch_more = False

        except requests.exceptions.Timeout:
            logging.error(f"Timeout en la llamada API balldontlie /games (Fecha {target_date_str}, Página {current_page})")
            fetch_more = False
        except requests.exceptions.RequestException as e:
            logging.error(f"Error en la llamada API balldontlie /games (Fecha {target_date_str}, Página {current_page}): {e}")
            status_code = e.response.status_code if hasattr(e, 'response') and e.response is not None else 'N/A'
            response_text = e.response.text if hasattr(e, 'response') and e.response is not None else 'N/A'
            logging.error(f"Response Status: {status_code}, Response Text: {response_text[:500]}...")
            if status_code == 401: logging.error("Error 401 Unauthorized: Verifica BALLDONTLIE_API_KEY.")
            fetch_more = False
        except Exception as e:
            logging.error(f"Error inesperado procesando respuesta API balldontlie /games (Fecha {target_date_str}, Página {current_page}): {e}")
            fetch_more = False

    return all_games_for_date

def process_and_save_bbal_games(games_data):
    operations = []
    processed_ids = set()

    for game_info in games_data:
        game_id = game_info.get('id')
        if not game_id or game_id in processed_ids:
            logging.warning(f"Game ID inválido o duplicado, saltando: {game_id}")
            continue
        processed_ids.add(game_id)

        try:
            if not all(k in game_info for k in ('date', 'status', 'home_team', 'visitor_team', 'season')) \
               or not isinstance(game_info.get('home_team'), dict) or not game_info['home_team'].get('id') \
               or not isinstance(game_info.get('visitor_team'), dict) or not game_info['visitor_team'].get('id'):
                logging.warning(f"Datos incompletos o mal formados para Game ID {game_id}. Saltando. Data: {game_info}")
                continue

            api_status = game_info['status']
            status_map = {'Final': 'finished', 'Scheduled': 'scheduled'}
            if "Qtr" in api_status or "Halftime" in api_status or "OT" in api_status:
                 match_status = 'inprogress'
            else:
                 match_status = status_map.get(api_status, api_status.lower())

            try:
                 match_date_dt = datetime.fromisoformat(game_info['date'].replace('Z', '+00:00'))
            except ValueError:
                 logging.error(f"Formato de fecha inesperado para Game ID {game_id}: {game_info['date']}. Saltando.")
                 continue

            match_doc_set = {
                'sport': 'Basketball',
                'matchDate': match_date_dt,
                'status': match_status,
                'league': {
                    'apiLeagueId': 12,
                    'name': 'NBA',
                    'season': str(game_info['season'])
                },
                'teams': {
                    'home': { 'apiTeamId': game_info['home_team']['id'], 'name': game_info['home_team'].get('full_name', 'Unknown') },
                    'away': { 'apiTeamId': game_info['visitor_team']['id'], 'name': game_info['visitor_team'].get('full_name', 'Unknown') }
                }
            }
            if api_status == 'Final' and (game_info.get('home_team_score', 0) > 0 or game_info.get('visitor_team_score', 0) > 0):
                 match_doc_set['scores'] = {
                     'home': game_info.get('home_team_score'),
                     'away': game_info.get('visitor_team_score')
                 }

            update_payload = {
                '$set': match_doc_set,
                '$setOnInsert': {
                    'createdAt': datetime.now(timezone.utc),
                    'apiBasketballGameId': game_id,
                    'detailedStatsFetched': False
                }
            }
            operations.append( UpdateOne({'apiBasketballGameId': game_id}, update_payload, upsert=True) )

        except Exception as e:
            logging.error(f"Error procesando Game ID {game_id} de balldontlie /games: {e}", exc_info=True)

    if operations:
        logging.info(f"Preparando bulk write con {len(operations)} operaciones para juegos de básquetbol...")
        try:
            result = matches_collection.bulk_write(operations, ordered=False)
            logging.info(f"Resultado Bulk write Games BKB: Inserted={result.inserted_count}, Matched={result.matched_count}, Modified={result.modified_count}, Upserted={result.upserted_count}")
            if result.bulk_api_result.get('writeErrors'): logging.error(f"Errores durante bulk write Games BKB: {result.bulk_api_result['writeErrors']}")
        except Exception as e:
            logging.error(f"Error durante bulk write Games BKB a MongoDB: {e}")
    else:
        logging.info("No hay operaciones BKB Games válidas para realizar en la BD.")

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
            logging.info(f"Esperando {wait_time:.1f} segundos antes de la siguiente llamada API BDL /games...")
            time.sleep(wait_time)

        games_for_day = fetch_bbal_games_for_date(target_date_str)
        api_call_count += 1

        if games_for_day:
            all_games_list.extend(games_for_day)

        current_date_to_fetch += timedelta(days=1)

    if all_games_list:
        unique_games_dict = {game['id']: game for game in all_games_list if isinstance(game, dict) and 'id' in game}
        unique_games_list = list(unique_games_dict.values())
        logging.info(f"Procesando un total de {len(unique_games_list)} partidos únicos obtenidos de BDL API /games...")
        process_and_save_bbal_games(unique_games_list)
    else:
        logging.info("No se obtuvieron datos de partidos BDL /games en esta ejecución.")

    end_time = time.time()
    logging.info(f"--- Fetch de Partidos de Básquetbol (BDL /games) Finalizado ({datetime.now()}) ---")
    logging.info(f"Tiempo total de ejecución: {end_time - start_time:.2f} segundos")
    logging.info(f"Total de días procesados: {api_call_count}")

    if client: client.close(); logging.info("Conexión MongoDB cerrada.")
