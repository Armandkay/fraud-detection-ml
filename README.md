# ML-Powered Financial Fraud Detection System

## Author
Armand Kayiranga

## Project Description
A machine learning-based credit card fraud detection system that analyzes transactions in real-time to identify potentially fraudulent activity. The system uses Gradient Boosting classification trained on 10,000 transactions to provide instant risk assessment with probability scores and confidence levels.

## GitHub Repository
[https://github.com/Armandkay/fraud-detection-ml.git]

## Features
- Real-time transaction fraud detection
- ML model comparison (Logistic Regression, Random Forest, Gradient Boosting)
- Interactive web interface for transaction analysis
- REST API endpoints for integration
- Visual analytics and model performance metrics

## Tech Stack
- **Machine Learning**: scikit-learn, pandas, numpy
- **Web Framework**: Flask
- **Visualization**: matplotlib, seaborn
- **Model Persistence**: joblib

## Project Structure
```
fraud-detection-ml/
├── app/
│   └── app.py                    # Flask web application
├── models/
│   ├── fraud_detection_model.pkl # Trained ML model
│   └── feature_info.pkl          # Feature metadata
├── notebook/
│   └── ML_Fraud_Detection_Enhanced.ipynb
├── data/
│   └── credit_card_fraud_10k.csv
└── requirements.txt
```

## Setup Instructions

### Prerequisites
- Python 3.12.0 or higher
- pip package manager

### Installation

1. Clone the repository
```bash
git clone [your-repo-url]
cd fraud-detection-ml
```

2. Create virtual environment
```bash
python -m venv venv
```

3. Activate virtual environment
- Windows:
```bash
venv\Scripts\activate
```
- macOS/Linux:
```bash
source venv/bin/activate
```

4. Install dependencies
```bash
pip install -r requirements.txt
```

5. Train the model
- Open `notebook/ML_Fraud_Detection_Enhanced.ipynb` in Jupyter or VS Code
- Run all cells to train and save the model
- Model files will be saved in `models/` directory

6. Run the web application
```bash
cd app
python app.py
```

7. Access the application
- Open browser and navigate to: `http://localhost:5000`

## Model Performance

| Model | Accuracy | Precision | Recall | F1-Score |
|-------|----------|-----------|--------|----------|
| Logistic Regression | 94.2% | 91.5% | 89.3% | 90.4% |
| Random Forest | 96.8% | 94.7% | 93.2% | 93.9% |
| Gradient Boosting | 97.3% | 95.8% | 94.5% | 95.1% |

*Best Model: Gradient Boosting Classifier*

## Features Used for Prediction
- Transaction Amount
- Transaction Hour (0-23)
- Merchant Category (Clothing, Electronics, Food, Grocery, Travel)
- Foreign Transaction (Yes/No)
- Location Mismatch (Yes/No)
- Device Trust Score (0-100)
- Transaction Velocity (Last 24h)
- Cardholder Age

## API Endpoints

### Predict Single Transaction
```
POST /api/predict
Content-Type: application/json

{
  "amount": 1000.00,
  "transaction_hour": 3,
  "merchant_category": "Electronics",
  "foreign_transaction": 1,
  "location_mismatch": 1,
  "device_trust_score": 15,
  "velocity_last_24h": 12,
  "cardholder_age": 25
}
```

### Model Info
```
GET /api/model_info
```

### Health Check
```
GET /health
```

## Testing Examples

### Fraudulent Transaction Example
- Amount: $9,999
- Hour: 3 (3 AM)
- Category: Electronics
- Age: 25
- Device Trust: 15
- Velocity: 12
- Foreign: Yes
- Location Mismatch: Yes

**Expected Result**: FRAUD DETECTED (100% probability)

### Safe Transaction Example
- Amount: $45.50
- Hour: 14 (2 PM)
- Category: Grocery
- Age: 35
- Device Trust: 90
- Velocity: 2
- Foreign: No
- Location Mismatch: No

**Expected Result**: TRANSACTION SAFE (LOW risk)

## Deployment Plan

### Current Deployment
- Local Flask development server
- Model files stored locally
- Single-instance application

### Future Production Deployment
1. **Cloud Platform**: Deploy to Heroku, AWS, or Google Cloud
2. **Database**: Migrate to PostgreSQL for transaction logging
3. **Scaling**: Implement load balancing for multiple instances
4. **Monitoring**: Add logging and performance monitoring
5. **Security**: Implement authentication and rate limiting
6. **CI/CD**: Set up automated testing and deployment pipeline

## Screenshots
- Fraud Detection Interface
<img width="953" height="511" alt="image" src="https://github.com/user-attachments/assets/0a7fa602-0845-46fd-a02e-1000e5332214" />

- Fraud Detected Result
  <img width="830" height="376" alt="Screenshot 2026-02-13 083240" src="https://github.com/user-attachments/assets/5acbbc3c-3e07-4260-a77f-6dd025fab0ca" />

- Safe Transaction Result
  <img width="955" height="509" alt="image" src="https://github.com/user-attachments/assets/7198b8c2-f6ee-457d-94da-66a0dd9d1a8b" />

- Model Performance Metrics
  
  <img width="523" height="130" alt="image" src="https://github.com/user-attachments/assets/ac01c8ba-33a8-4a0c-a17b-1c197ae0e47d" />


## Video Demo
[https://youtu.be/zxHh-WMnqe4]

## License
MIT License

## Contact
Armand Kayiranga
[a.kayiranga1@alustudent.com]
