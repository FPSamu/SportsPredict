# prediction-service/predict.py
import sys
import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId
from datetime import datetime, timezone
import logging # Importar logging

# Configurar logging (puedes ajustar el nivel a DEBUG para ver más detalle)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr) # Loguear a stderr

# Cargar variables de entorno
load_dotenv()
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = os.getenv('DB_NAME')

client = None
db = None
matches_collection = None

def connect_to_db():
    global client, db, matches_collection
    if client is None:
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
            client.admin.command('ping')
            db = client[DB_NAME]
            matches_collection = db['matches']
            logging.info("Python: MongoDB conectado.")
        except Exception as e:
            logging.error(f"Python: Error conectando a MongoDB: {str(e)}")
            # Imprimir error como JSON para que Node.js lo capture si falla la conexión
            print(json.dumps({"error": "Error de conexión a la base de datos en el servicio de predicción.", "details": str(e)}))
            sys.exit(1)

def get_match_data_from_db(sport, home_team_api_id, away_team_api_id, num_recent_games=10, num_h2h_games=5):
    if matches_collection is None:
        logging.error("Python: Colección de partidos no inicializada en get_match_data_from_db.")
        return {"error": "Colección de partidos no inicializada."}
    try:
        home_id = int(home_team_api_id)
        away_id = int(away_team_api_id)
        results = {"home_team_recent_matches": [], "away_team_recent_matches": [], "h2h_matches": []}

        # Partidos recientes del equipo local
        home_query = {
            "sport": sport, "status": "finished",
            "scores.home": {"$type": "number"}, "scores.away": {"$type": "number"}, # Asegurar que scores son numéricos
            "$or": [{"teams.home.apiTeamId": home_id}, {"teams.away.apiTeamId": home_id}]
        }
        results["home_team_recent_matches"] = list(matches_collection.find(home_query).sort("matchDate", -1).limit(num_recent_games))

        # Partidos recientes del equipo visitante
        away_query = {
            "sport": sport, "status": "finished",
            "scores.home": {"$type": "number"}, "scores.away": {"$type": "number"},
            "$or": [{"teams.home.apiTeamId": away_id}, {"teams.away.apiTeamId": away_id}]
        }
        results["away_team_recent_matches"] = list(matches_collection.find(away_query).sort("matchDate", -1).limit(num_recent_games))

        # H2H
        h2h_query = {
            "sport": sport, "status": "finished",
            "scores.home": {"$type": "number"}, "scores.away": {"$type": "number"},
            "$or": [
                {"teams.home.apiTeamId": home_id, "teams.away.apiTeamId": away_id},
                {"teams.home.apiTeamId": away_id, "teams.away.apiTeamId": home_id}
            ]
        }
        results["h2h_matches"] = list(matches_collection.find(h2h_query).sort("matchDate", -1).limit(num_h2h_games))

        # Limpiar ObjectIds y datetimes para serialización JSON
        for key in results:
            for match_idx, match in enumerate(results[key]):
                clean_match = {}
                for field, value in match.items():
                    if isinstance(value, ObjectId):
                        clean_match[field] = str(value)
                    elif isinstance(value, datetime):
                        clean_match[field] = value.isoformat()
                    elif isinstance(value, dict): # Para subdocumentos como league, teams, scores
                        clean_sub_doc = {}
                        for sub_key, sub_value in value.items():
                            if isinstance(sub_value, datetime):
                                clean_sub_doc[sub_key] = sub_value.isoformat()
                            elif isinstance(sub_value, dict): # Para teams.home, teams.away
                                 clean_team_doc = {}
                                 for team_key, team_value in sub_value.items():
                                      if isinstance(team_value, datetime):
                                           clean_team_doc[team_key] = team_value.isoformat()
                                      else:
                                           clean_team_doc[team_key] = team_value
                                 clean_sub_doc[sub_key] = clean_team_doc
                            else:
                                clean_sub_doc[sub_key] = sub_value
                        clean_match[field] = clean_sub_doc
                    else:
                        clean_match[field] = value
                results[key][match_idx] = clean_match # Reemplazar el original con el limpio
        return results
    except Exception as e:
        logging.error(f"Python: Error consultando la base de datos: {str(e)}")
        return {"error": f"Error consultando la base de datos en Python: {str(e)}"}

def _calculate_team_averages(matches, team_id):
    scored_sum, conceded_sum, games_played = 0, 0, 0
    for match in matches:
        if match.get("scores") and isinstance(match["scores"].get("home"), int) and isinstance(match["scores"].get("away"), int):
            games_played += 1
            is_home = match.get("teams", {}).get("home", {}).get("apiTeamId") == team_id
            is_away = match.get("teams", {}).get("away", {}).get("apiTeamId") == team_id
            if is_home:
                scored_sum += match["scores"]["home"]
                conceded_sum += match["scores"]["away"]
            elif is_away:
                scored_sum += match["scores"]["away"]
                conceded_sum += match["scores"]["home"]
    avg_scored = round(scored_sum / games_played, 2) if games_played > 0 else 0.0
    avg_conceded = round(conceded_sum / games_played, 2) if games_played > 0 else 0.0
    return avg_scored, avg_conceded, games_played

def _get_form_stats(matches, team_id):
    wins, draws, losses = 0, 0, 0
    for match in matches:
        if match.get("scores") and isinstance(match["scores"].get("home"), int) and isinstance(match["scores"].get("away"), int):
            home_score = match["scores"]["home"]
            away_score = match["scores"]["away"]
            is_home = match.get("teams", {}).get("home", {}).get("apiTeamId") == team_id
            is_away = match.get("teams", {}).get("away", {}).get("apiTeamId") == team_id
            if is_home:
                if home_score > away_score: wins += 1
                elif home_score == away_score: draws += 1
                else: losses += 1
            elif is_away:
                if away_score > home_score: wins += 1
                elif home_score == away_score: draws += 1
                else: losses += 1
    return wins, draws, losses

def calculate_football_winner_prob(home_id, away_id, historical_data, form_weight=0.6, h2h_weight=0.4):
    home_form_w, home_form_d, home_form_l = _get_form_stats(historical_data.get("home_team_recent_matches", []), home_id)
    away_form_w, away_form_d, away_form_l = _get_form_stats(historical_data.get("away_team_recent_matches", []), away_id)
    n_home_form = home_form_w + home_form_d + home_form_l
    n_away_form = away_form_w + away_form_d + away_form_l

    h2h_home_wins, h2h_draws, h2h_away_wins = 0, 0, 0
    for match in historical_data.get("h2h_matches", []):
         if match.get("scores") and isinstance(match["scores"].get("home"), int):
            is_current_home_was_h2h_home = match["teams"]["home"]["apiTeamId"] == home_id
            if is_current_home_was_h2h_home:
                if match["scores"]["home"] > match["scores"]["away"]: h2h_home_wins += 1
                elif match["scores"]["away"] > match["scores"]["home"]: h2h_away_wins += 1
                else: h2h_draws += 1
            else: # Current home was away in H2H
                if match["scores"]["away"] > match["scores"]["home"]: h2h_home_wins += 1
                elif match["scores"]["home"] > match["scores"]["away"]: h2h_away_wins += 1
                else: h2h_draws += 1
    n_h2h = h2h_home_wins + h2h_draws + h2h_away_wins

    # Form points (0-1 scale)
    home_form_pts = (home_form_w * 3 + home_form_d * 1) / (n_home_form * 3) if n_home_form > 0 else 0.33
    away_form_pts = (away_form_w * 3 + away_form_d * 1) / (n_away_form * 3) if n_away_form > 0 else 0.33
    
    # H2H factors (0-1 scale)
    h2h_home_f = h2h_home_wins / n_h2h if n_h2h > 0 else 0.33
    h2h_draw_f = h2h_draws / n_h2h if n_h2h > 0 else 0.34
    h2h_away_f = h2h_away_wins / n_h2h if n_h2h > 0 else 0.33

    # Weighted scores
    score_h = home_form_pts * form_weight + h2h_home_f * h2h_weight
    score_a = away_form_pts * form_weight + h2h_away_f * h2h_weight
    # Draw score can be average of draw forms + h2h draw factor
    avg_draw_form = ((home_form_d / n_home_form if n_home_form > 0 else 0.33) + \
                     (away_form_d / n_away_form if n_away_form > 0 else 0.33)) / 2
    score_d = avg_draw_form * form_weight + h2h_draw_f * h2h_weight
    
    total_score = score_h + score_d + score_a
    if total_score == 0: return {"home": 0.33, "draw": 0.34, "away": 0.33}
    return {"home": round(score_h / total_score, 2), "draw": round(score_d / total_score, 2), "away": round(score_a / total_score, 2)}

def calculate_general_over_under(historical_data, default_lines):
    predictions_for_lines = []
    all_matches = historical_data.get("home_team_recent_matches", []) + \
                  historical_data.get("away_team_recent_matches", []) + \
                  historical_data.get("h2h_matches", [])
    unique_matches = list({match['_id']: match for match in all_matches if match.get('_id') and match.get("scores") and isinstance(match["scores"].get("home"), int)}.values())

    if not unique_matches:
        for line in default_lines:
            predictions_for_lines.append({"line": line, "over": 0.50, "under": 0.50, "source": "default_no_data"})
        return predictions_for_lines

    for line in default_lines:
        overs, unders = 0, 0
        for match in unique_matches:
            total_score = match["scores"]["home"] + match["scores"]["away"]
            if total_score > line: overs += 1
            else: unders += 1
        
        total_considered = len(unique_matches)
        prob_over = round(overs / total_considered, 2)
        prob_under = round(unders / total_considered, 2)
        
        # Simple normalization if sum is not 1.00 due to rounding
        if prob_over + prob_under != 1.00:
            if prob_over > prob_under: prob_over = 1.00 - prob_under
            else: prob_under = 1.00 - prob_over
            prob_over = round(prob_over, 2) # Re-round after adjustment
            prob_under = round(prob_under, 2)


        predictions_for_lines.append({"line": line, "over": prob_over, "under": prob_under, "source": "historical_frequency"})
    return predictions_for_lines

def calculate_btts_prob(historical_data):
    yes, no, games_counted = 0, 0, 0
    all_matches = historical_data.get("home_team_recent_matches", []) + \
                  historical_data.get("away_team_recent_matches", []) + \
                  historical_data.get("h2h_matches", [])
    unique_matches = list({match['_id']: match for match in all_matches if match.get('_id') and match.get("scores") and isinstance(match["scores"].get("home"), int)}.values())

    for match in unique_matches:
        games_counted +=1
        if match["scores"]["home"] > 0 and match["scores"]["away"] > 0: yes +=1
        else: no +=1
    if games_counted == 0: return {"yes": 0.5, "no": 0.5}
    return {"yes": round(yes / games_counted, 2), "no": round(no / games_counted, 2)}

def calculate_basketball_winner_prob(home_id, away_id, historical_data, form_weight=0.6, h2h_weight=0.4):
    home_form_w, _, home_form_l = _get_form_stats(historical_data.get("home_team_recent_matches", []), home_id)
    away_form_w, _, away_form_l = _get_form_stats(historical_data.get("away_team_recent_matches", []), away_id)
    n_home_form = home_form_w + home_form_l # No draws in basketball for form
    n_away_form = away_form_w + away_form_l

    h2h_home_wins, h2h_draws_ignored, h2h_away_wins = 0,0,0
    for match in historical_data.get("h2h_matches", []):
         if match.get("scores") and isinstance(match["scores"].get("home"), int):
            if match["teams"]["home"]["apiTeamId"] == home_id:
                if match["scores"]["home"] > match["scores"]["away"]: h2h_home_wins += 1
                elif match["scores"]["away"] > match["scores"]["home"]: h2h_away_wins += 1
            elif match["teams"]["away"]["apiTeamId"] == home_id:
                if match["scores"]["away"] > match["scores"]["home"]: h2h_home_wins += 1
                elif match["scores"]["home"] > match["scores"]["away"]: h2h_away_wins += 1
    n_h2h = h2h_home_wins + h2h_away_wins

    home_form_pts = home_form_w / n_home_form if n_home_form > 0 else 0.5
    away_form_pts = away_form_w / n_away_form if n_away_form > 0 else 0.5
    h2h_home_f = h2h_home_wins / n_h2h if n_h2h > 0 else 0.5
    h2h_away_f = h2h_away_wins / n_h2h if n_h2h > 0 else 0.5
    
    score_h = home_form_pts * form_weight + h2h_home_f * h2h_weight
    score_a = away_form_pts * form_weight + h2h_away_f * h2h_weight
    total_score = score_h + score_a
    if total_score == 0: return {"home": 0.50, "away": 0.50}
    return {"home": round(score_h / total_score, 2), "away": round(score_a / total_score, 2)}

def get_dynamic_basketball_lines(historical_data, home_id, away_id):
    home_avg_s, home_avg_c, _ = _calculate_team_averages(historical_data.get("home_team_recent_matches", []), home_id)
    away_avg_s, away_avg_c, _ = _calculate_team_averages(historical_data.get("away_team_recent_matches", []), away_id)
    
    expected_home_pts = (home_avg_s + away_avg_c) / 2 if (home_avg_s + away_avg_c) > 0 else 105 # Fallback
    expected_away_pts = (away_avg_s + home_avg_c) / 2 if (away_avg_s + home_avg_c) > 0 else 105 # Fallback
    expected_total = expected_home_pts + expected_away_pts
    
    central_line = round(expected_total / 0.5) * 0.5 # Redondear al .5 más cercano
    lines = sorted(list(set([max(150, central_line - 10), max(150, central_line - 5), max(150, central_line), max(150, central_line + 5), max(150, central_line + 10)])))
    return lines if lines else [220.5] # Fallback

def calculate_predictions(sport, home_team_api_id, away_team_api_id, historical_data):
    predictions = {}
    home_id = int(home_team_api_id)
    away_id = int(away_team_api_id)

    if "error" in historical_data and "h2h_matches_found" not in historical_data:
        predictions["error_fetching_data"] = historical_data["error"]
        return predictions
    
    min_games_threshold = 3 # Mínimo de partidos en alguna categoría para intentar predecir
    if len(historical_data.get("home_team_recent_matches", [])) < min_games_threshold and \
       len(historical_data.get("away_team_recent_matches", [])) < min_games_threshold and \
       len(historical_data.get("h2h_matches", [])) < 1: # H2H puede ser 0, pero no recientes
        predictions["no_sufficient_data"] = "No hay suficientes datos históricos para estos equipos."
        if sport == "Football":
            predictions["ft_winner_prob"] = {"home": 0.33, "draw": 0.34, "away": 0.33}
            predictions["ft_ou_goals_prob"] = [{"line": 2.5, "over": 0.5, "under": 0.5, "source": "default_no_data"}]
            predictions["ft_btts_prob"] = {"yes": 0.5, "no": 0.5}
        elif sport == "Basketball":
            predictions["bk_winner_prob"] = {"home": 0.50, "away": 0.50}
            predictions["bk_total_pts_prob"] = [{"line": 220.5, "over": 0.5, "under": 0.5, "source": "default_no_data"}]
        return predictions

    if sport == "Football":
        predictions["ft_winner_prob"] = calculate_football_winner_prob(home_id, away_id, historical_data)
        predictions["ft_ou_goals_prob"] = calculate_general_over_under(historical_data, default_lines=[1.5, 2.5, 3.5])
        predictions["ft_btts_prob"] = calculate_btts_prob(historical_data)
    elif sport == "Basketball":
        dynamic_lines = get_dynamic_basketball_lines(historical_data, home_id, away_id)
        predictions["bk_winner_prob"] = calculate_basketball_winner_prob(home_id, away_id, historical_data)
        predictions["bk_total_pts_prob"] = calculate_general_over_under(historical_data, default_lines=dynamic_lines)

    return predictions

if __name__ == "__main__":
    if len(sys.argv) == 4:
        sport_arg = sys.argv[1]
        home_team_id_arg = sys.argv[2]
        away_team_id_arg = sys.argv[3]
        connect_to_db()
        historical_data = get_match_data_from_db(sport_arg, home_team_id_arg, away_team_id_arg)
        if "error" in historical_data and "h2h_matches_found" not in historical_data:
            print(json.dumps(historical_data))
        else:
            final_predictions = calculate_predictions(sport_arg, home_team_id_arg, away_team_id_arg, historical_data)
            print(json.dumps({"sport": sport_arg, "predictions": final_predictions}))
    else:
        error_output = {
            "error": "Número o formato de argumentos incorrectos para predict.py.",
            "usage": "predict.py <sport_string> <home_team_api_id_int> <away_team_api_id_int>",
            "received_args_count": len(sys.argv) -1,
            "received_args": sys.argv[1:]
        }
        print(json.dumps(error_output))
        sys.exit(1)