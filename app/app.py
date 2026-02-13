"""
Fraud Detection Web Application
Flask API for Real-time Transaction Fraud Prediction
Author: Armand Kayiranga
Project: ML-Powered Financial Fraud Detection System
"""
from flask import Flask, request, jsonify, render_template_string
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
import os

app = Flask(__name__)

# Load the trained model
MODEL_PATH = '../models/fraud_detection_model.pkl'
FEATURE_INFO_PATH = '../models/feature_info.pkl'

try:
    model = joblib.load(MODEL_PATH)
    feature_info = joblib.load(FEATURE_INFO_PATH)
    print("✓ Model loaded successfully")
    print(f"✓ Model type: {type(model.named_steps['classifier']).__name__}")
except Exception as e:
    model = None
    feature_info = None
    print(f"⚠ Model loading failed: {str(e)}")
    print("Please run the Jupyter notebook first to train and save the model.")

# HTML Template embedded in the app
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔒 ML Fraud Detection System</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .section-title {
            color: #667eea;
            margin-bottom: 25px;
            font-size: 1.5em;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        
        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
        }
        
        label {
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
            font-size: 0.95em;
        }
        
        input, select {
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: all 0.3s;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        button {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            margin-top: 10px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        #result {
            margin-top: 40px;
            padding: 30px;
            border-radius: 10px;
            display: none;
            animation: slideIn 0.5s;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .fraud {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
            border: 3px solid #ff4757;
        }
        
        .safe {
            background: linear-gradient(135deg, #51cf66 0%, #37b24d 100%);
            color: white;
            border: 3px solid #2f9e44;
        }
        
        .result-header {
            font-size: 2em;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .result-details {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .detail-box {
            background: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 8px;
        }
        
        .detail-label {
            font-size: 0.9em;
            opacity: 0.9;
            margin-bottom: 5px;
        }
        
        .detail-value {
            font-size: 1.5em;
            font-weight: 700;
        }
        
        .info-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
        }
        
        .info-box h3 {
            color: #667eea;
            margin-bottom: 10px;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 ML-Powered Fraud Detection System</h1>
        <p>Real-time Credit Card Transaction Analysis</p>
        <p style="font-size: 0.9em; margin-top: 5px;">Author: Armand Kayiranga</p>
    </div>
    
    <div class="container">
        <div class="info-box">
            <h3>📊 How It Works</h3>
            <p>This system uses advanced machine learning (Gradient Boosting) trained on 10,000 transactions to detect fraudulent credit card activity in real-time. Enter transaction details below to get instant fraud risk assessment.</p>
        </div>
        
        <h2 class="section-title">Transaction Details</h2>
        
        <form id="fraudForm">
            <div class="form-grid">
                <div class="form-group">
                    <label for="amount">💰 Transaction Amount ($)</label>
                    <input type="number" step="0.01" id="amount" name="amount" placeholder="e.g., 250.00" required>
                </div>
                
                <div class="form-group">
                    <label for="transaction_hour">🕐 Transaction Hour (0-23)</label>
                    <input type="number" min="0" max="23" id="transaction_hour" name="transaction_hour" placeholder="e.g., 14" required>
                </div>
                
                <div class="form-group">
                    <label for="merchant_category">🏪 Merchant Category</label>
                    <select id="merchant_category" name="merchant_category" required>
                        <option value="">Select category...</option>
                        <option value="Clothing">Clothing</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Food">Food</option>
                        <option value="Grocery">Grocery</option>
                        <option value="Travel">Travel</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="cardholder_age">👤 Cardholder Age</label>
                    <input type="number" min="18" max="120" id="cardholder_age" name="cardholder_age" placeholder="e.g., 35" required>
                </div>
                
                <div class="form-group">
                    <label for="device_trust_score">📱 Device Trust Score (0-100)</label>
                    <input type="number" min="0" max="100" id="device_trust_score" name="device_trust_score" placeholder="e.g., 85" required>
                </div>
                
                <div class="form-group">
                    <label for="velocity_last_24h">⚡ Transactions (Last 24h)</label>
                    <input type="number" min="0" id="velocity_last_24h" name="velocity_last_24h" placeholder="e.g., 3" required>
                </div>
                
                <div class="form-group">
                    <label for="foreign_transaction">🌍 Foreign Transaction?</label>
                    <select id="foreign_transaction" name="foreign_transaction" required>
                        <option value="0">No (Domestic)</option>
                        <option value="1">Yes (International)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="location_mismatch">📍 Location Mismatch?</label>
                    <select id="location_mismatch" name="location_mismatch" required>
                        <option value="0">No (Expected Location)</option>
                        <option value="1">Yes (Unusual Location)</option>
                    </select>
                </div>
            </div>
            
            <button type="submit">🔍 Analyze Transaction</button>
        </form>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p style="margin-top: 15px; color: #667eea;">Analyzing transaction...</p>
        </div>
        
        <div id="result"></div>
    </div>

    <script>
        document.getElementById('fraudForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Show loading
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result').style.display = 'none';
            
            const formData = new FormData(e.target);
            const data = {};
            
            // Convert form data to proper types
            formData.forEach((value, key) => {
                if (['amount', 'transaction_hour', 'device_trust_score', 'velocity_last_24h', 'cardholder_age'].includes(key)) {
                    data[key] = parseFloat(value);
                } else if (['foreign_transaction', 'location_mismatch'].includes(key)) {
                    data[key] = parseInt(value);
                } else {
                    data[key] = value;
                }
            });
            
            try {
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                // Hide loading
                document.getElementById('loading').style.display = 'none';
                
                if (response.ok) {
                    displayResult(result);
                } else {
                    alert('Error: ' + (result.error || 'Unknown error occurred'));
                }
            } catch (error) {
                document.getElementById('loading').style.display = 'none';
                alert('Network error: ' + error.message);
            }
        });
        
        function displayResult(result) {
            const resultDiv = document.getElementById('result');
            const isFraud = result.is_fraud === 1;
            const probability = (result.fraud_probability * 100).toFixed(1);
            
            resultDiv.className = isFraud ? 'fraud' : 'safe';
            
            const icon = isFraud ? '⚠️' : '✅';
            const title = isFraud ? 'FRAUD DETECTED' : 'TRANSACTION SAFE';
            const message = isFraud 
                ? 'This transaction has been flagged as potentially fraudulent.'
                : 'This transaction appears to be legitimate.';
            
            resultDiv.innerHTML = `
                <div class="result-header">
                    <span style="font-size: 1.2em;">${icon}</span>
                    <span>${title}</span>
                </div>
                <p style="font-size: 1.1em; margin-bottom: 20px;">${message}</p>
                <div class="result-details">
                    <div class="detail-box">
                        <div class="detail-label">Fraud Probability</div>
                        <div class="detail-value">${probability}%</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-label">Risk Level</div>
                        <div class="detail-value">${result.risk_level}</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-label">Confidence</div>
                        <div class="detail-value">${(result.confidence * 100).toFixed(1)}%</div>
                    </div>
                    <div class="detail-box">
                        <div class="detail-label">Analysis Time</div>
                        <div class="detail-value">${new Date(result.timestamp).toLocaleTimeString()}</div>
                    </div>
                </div>
            `;
            
            resultDiv.style.display = 'block';
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    </script>
</body>
</html>
"""

@app.route('/')
def home():
    """Render the main web interface"""
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    API endpoint for fraud prediction
    
    Expected JSON input:
    {
        "amount": float,
        "transaction_hour": int (0-23),
        "merchant_category": str,
        "foreign_transaction": int (0 or 1),
        "location_mismatch": int (0 or 1),
        "device_trust_score": int (0-100),
        "velocity_last_24h": int,
        "cardholder_age": int
    }
    
    Returns:
    {
        "is_fraud": int (0 or 1),
        "fraud_probability": float,
        "risk_level": str,
        "timestamp": str
    }
    """
    if model is None:
        return jsonify({
            'error': 'Model not loaded. Please train the model first by running the Jupyter notebook.'
        }), 500
    
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Validate required fields
        required_fields = [
            'amount', 'transaction_hour', 'merchant_category',
            'foreign_transaction', 'location_mismatch',
            'device_trust_score', 'velocity_last_24h', 'cardholder_age'
        ]
        
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Create DataFrame with correct column order matching training
        input_data = pd.DataFrame({
            'amount': [float(data['amount'])],
            'transaction_hour': [int(data['transaction_hour'])],
            'device_trust_score': [int(data['device_trust_score'])],
            'velocity_last_24h': [int(data['velocity_last_24h'])],
            'cardholder_age': [int(data['cardholder_age'])],
            'merchant_category': [str(data['merchant_category'])],
            'foreign_transaction': [int(data['foreign_transaction'])],
            'location_mismatch': [int(data['location_mismatch'])]
        })
        
        # Make prediction
        prediction = model.predict(input_data)[0]
        probability = model.predict_proba(input_data)[0][1]
        
        # Determine risk level
        if probability < 0.3:
            risk_level = "LOW"
        elif probability < 0.7:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"
        
        # Prepare response
        response = {
            'is_fraud': int(prediction),
            'fraud_probability': float(probability),
            'risk_level': risk_level,
            'confidence': float(max(probability, 1 - probability)),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        return jsonify({
            'error': f'Prediction failed: {str(e)}'
        }), 500

@app.route('/api/model_info', methods=['GET'])
def model_info():
    """Get information about the loaded model"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    return jsonify({
        'model_type': type(model.named_steps['classifier']).__name__,
        'features': feature_info['all_features'] if feature_info else [],
        'status': 'active',
        'version': '1.0.0',
        'author': 'Armand Kayiranga'
    }), 200

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'timestamp': datetime.now().isoformat()
    }), 200

if __name__ == '__main__':
    # Check if model exists
    if not os.path.exists(MODEL_PATH):
        print("\n" + "="*70)
        print("⚠️  WARNING: Model file not found!")
        print("="*70)
        print(f"Expected path: {MODEL_PATH}")
        print("\nPlease ensure you have:")
        print("1. Run the Jupyter notebook (ML_Fraud_Detection_Enhanced.ipynb)")
        print("2. The model files are saved in the 'models/' directory")
        print("="*70 + "\n")
    
    # Run the Flask app
    print("\n" + "="*70)
    print("🚀 Starting Fraud Detection Web Application")
    print("="*70)
    print(f"Model Status: {'✓ Loaded' if model else '✗ Not Loaded'}")
    print("Access the application at: http://localhost:5000")
    print("API Documentation at: http://localhost:5000/api/model_info")
    print("Health Check at: http://localhost:5000/health")
    print("="*70 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
