from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import requests
import webbrowser
import os
from functools import wraps

app = Flask(__name__)
CORS(app)

API_BASE_URL = "https://home.sunnytseng.com/api"
TOKEN = None

def login_and_get_token():
    global TOKEN
    login_data = {"username": "sunny", "password": "open"}
    headers = {'Content-Type': 'application/json'}
    response = requests.post(f"{API_BASE_URL}/login/", headers=headers, json=login_data)
    if response.status_code == 200:
        data = response.json()
        TOKEN = data.get('access')
        if TOKEN:
            print("Login successful. Access Token acquired.")
        else:
            print("Login failed. Access Token not acquired.")
    else:
        print("Login request failed:", response.status_code, response.text)

def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        global TOKEN
        if not TOKEN:
            login_and_get_token()
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/tasks', methods=['GET'])
@token_required
def get_tasks():
    global TOKEN
    headers = {'Authorization': f'Bearer {TOKEN}'}
    response = requests.get(f"{API_BASE_URL}/get-toDoNotes/", headers=headers)
    if response.status_code == 401:
        print("Authentication failed. Trying to log in again.")
        login_and_get_token()
        headers = {'Authorization': f'Bearer {TOKEN}'}
        response = requests.get(f"{API_BASE_URL}/get-toDoNotes/", headers=headers)
    
    return jsonify(response.json()), response.status_code

@app.route('/save_tasks', methods=['POST'])
@token_required
def save_tasks():
    global TOKEN
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    data = request.json
    response = requests.post(f"{API_BASE_URL}/save-toDoNotes/", headers=headers, json=data)
    
    if response.status_code == 401:
        print("Authentication failed. Trying to log in again.")
        login_and_get_token()
        headers = {
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json'
        }
        response = requests.post(f"{API_BASE_URL}/save-toDoNotes/", headers=headers, json=data)
    
    return jsonify(response.json()), response.status_code

if __name__ == '__main__':
    login_and_get_token()
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        webbrowser.open("http://127.0.0.1:7777")
    app.run(debug=True, port=7777)
