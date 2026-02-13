# Deployment Plan - ML Fraud Detection System

**Project:** ML-Powered Financial Fraud Detection System  
**Author:** Armand Kayiranga  
**Version:** 1.0.0  
**Date:** February 2026

---

## 1. Deployment Overview

### Objectives
- Deploy machine learning fraud detection system
- Provide web-based interface for real-time predictions
- Ensure scalability and reliability
- Enable API access for integration

### Deployment Scope
- **Phase 1:** Local deployment for development and testing
- **Phase 2:** Cloud deployment for production use
- **Phase 3:** Monitoring and continuous improvement

---

## 2. Architecture

### System Components

```
┌─────────────────────────────────────────────────┐
│             User Interface (Browser)            │
└────────────────┬────────────────────────────────┘
                 │ HTTP/HTTPS
┌────────────────▼────────────────────────────────┐
│         Flask Web Application (app.py)          │
│  ┌────────────────────────────────────────┐    │
│  │   Routes & API Endpoints               │    │
│  └────────────────┬───────────────────────┘    │
│                   │                             │
│  ┌────────────────▼───────────────────────┐    │
│  │   Model Prediction Engine              │    │
│  └────────────────┬───────────────────────┘    │
└───────────────────┼─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│   ML Model (fraud_detection_model.pkl)          │
│   - Random Forest Classifier                    │
│   - Preprocessing Pipeline                      │
│   - Feature Engineering                         │
└─────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** Python 3.8+, Flask 2.3
- **ML Framework:** scikit-learn 1.3
- **Data Processing:** pandas, numpy
- **Deployment:** Local/Cloud (Heroku, AWS, GCP)

---

## 3. Local Deployment

### Prerequisites
- Python 3.8 or higher
- pip package manager
- 4GB RAM minimum
- 2GB free disk space

### Step-by-Step Instructions

#### Step 1: Environment Setup
```bash
# Clone repository
git clone [repository-url]
cd fraud-detection-system

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

#### Step 2: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### Step 3: Train Model
```bash
# Launch Jupyter Notebook
jupyter notebook

# Open ML_Fraud_Detection_Enhanced.ipynb
# Run all cells to train and save model
# This generates:
# - fraud_detection_model.pkl
# - feature_info.pkl
```

#### Step 4: Run Application
```bash
python app.py
```

#### Step 5: Access Application
- Open browser: `http://localhost:5000`
- Test prediction with sample data
- Verify API endpoints

### Verification Checklist
- [ ] All dependencies installed successfully
- [ ] Model trained and saved (`.pkl` files exist)
- [ ] Flask server running without errors
- [ ] Web interface accessible
- [ ] API endpoints responding correctly
- [ ] Predictions returning expected results

---

## 4. Cloud Deployment

### Option A: Heroku Deployment

#### Prerequisites
- Heroku account
- Heroku CLI installed
- Git initialized repository

#### Deployment Steps

1. **Create Heroku App**
```bash
heroku login
heroku create fraud-detection-ml-[your-name]
```

2. **Configure Files**

Create `Procfile`:
```
web: python app.py
```

Create `runtime.txt`:
```
python-3.9.0
```

3. **Deploy Application**
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

4. **Open Application**
```bash
heroku open
```

#### Configuration
```bash
# Set environment variables if needed
heroku config:set FLASK_ENV=production
heroku config:set MODEL_PATH=fraud_detection_model.pkl
```

### Option B: AWS EC2 Deployment

#### Prerequisites
- AWS account
- EC2 instance (t2.medium or higher)
- SSH key pair

#### Deployment Steps

1. **Launch EC2 Instance**
- AMI: Ubuntu 20.04 LTS
- Instance Type: t2.medium
- Storage: 20GB
- Security Group: Allow port 5000

2. **Connect to Instance**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

3. **Setup Environment**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3-pip python3-venv -y

# Clone repository
git clone [repository-url]
cd fraud-detection-system

# Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

4. **Configure Firewall**
```bash
sudo ufw allow 5000
sudo ufw enable
```

5. **Run Application (Production)**
```bash
# Install gunicorn
pip install gunicorn

# Run with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

6. **Setup as Service (Optional)**
Create `/etc/systemd/system/fraud-detection.service`:
```ini
[Unit]
Description=Fraud Detection Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/fraud-detection-system
Environment="PATH=/home/ubuntu/fraud-detection-system/venv/bin"
ExecStart=/home/ubuntu/fraud-detection-system/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start fraud-detection
sudo systemctl enable fraud-detection
```

### Option C: Docker Deployment

#### Dockerfile
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port
EXPOSE 5000

# Run application
CMD ["python", "app.py"]
```

#### Build and Run
```bash
# Build image
docker build -t fraud-detection:latest .

# Run container
docker run -d -p 5000:5000 --name fraud-detection fraud-detection:latest

# View logs
docker logs fraud-detection

# Stop container
docker stop fraud-detection
```

#### Docker Compose (Optional)
```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./models:/app/models
    environment:
      - FLASK_ENV=production
```

---

## 5. Performance Optimization

### Model Optimization
- Use model compression techniques
- Implement model caching
- Optimize preprocessing pipeline

### Application Optimization
```python
# app.py modifications for production

# Enable CORS for API
from flask_cors import CORS
CORS(app)

# Add request rate limiting
from flask_limiter import Limiter
limiter = Limiter(app, key_func=lambda: request.remote_addr)

@app.route('/api/predict', methods=['POST'])
@limiter.limit("100 per minute")
def predict():
    # prediction logic
    pass

# Enable caching
from flask_caching import Cache
cache = Cache(app, config={'CACHE_TYPE': 'simple'})
```

### Server Configuration
- Use production WSGI server (Gunicorn, uWSGI)
- Enable HTTPS with SSL certificates
- Configure reverse proxy (Nginx)

---

## 6. Monitoring and Maintenance

### Monitoring Setup

#### Application Monitoring
```python
# Add logging
import logging
logging.basicConfig(level=logging.INFO)

@app.route('/api/predict', methods=['POST'])
def predict():
    logging.info(f"Prediction request received at {datetime.now()}")
    # prediction logic
    logging.info(f"Prediction completed: {result}")
```

#### Health Checks
```python
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'timestamp': datetime.now().isoformat()
    })
```

### Metrics to Track
- Request count per hour
- Average response time
- Prediction distribution (fraud vs legitimate)
- Error rate
- System resource usage (CPU, memory)

### Maintenance Tasks
- **Daily:** Check error logs
- **Weekly:** Review performance metrics
- **Monthly:** Retrain model with new data
- **Quarterly:** Update dependencies and security patches

---

## 7. Security Considerations

### Application Security
```python
# Add authentication (example)
from functools import wraps

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != os.environ.get('API_KEY'):
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/predict', methods=['POST'])
@require_api_key
def predict():
    # prediction logic
    pass
```

### Best Practices
- Use environment variables for sensitive data
- Enable HTTPS in production
- Implement rate limiting
- Validate and sanitize all inputs
- Keep dependencies updated
- Use strong authentication for admin endpoints

---

## 8. Backup and Recovery

### Model Backup
```bash
# Backup trained models
mkdir -p backups
cp fraud_detection_model.pkl backups/model_$(date +%Y%m%d).pkl
cp feature_info.pkl backups/features_$(date +%Y%m%d).pkl
```

### Automated Backups
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
cp *.pkl backups/
tar -czf backups/backup_$DATE.tar.gz *.pkl *.py templates/
find backups/ -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x backup.sh

# Add to crontab (daily at 2 AM)
0 2 * * * /path/to/backup.sh
```

### Recovery Procedure
1. Identify last working backup
2. Stop application
3. Restore backup files
4. Verify model integrity
5. Restart application
6. Test predictions

---

## 9. Scaling Strategy

### Vertical Scaling
- Upgrade server resources (CPU, RAM)
- Optimize model inference time
- Use model quantization

### Horizontal Scaling
```python
# Use load balancer (Nginx example)
upstream fraud_detection {
    server localhost:5001;
    server localhost:5002;
    server localhost:5003;
}

server {
    listen 80;
    location / {
        proxy_pass http://fraud_detection;
    }
}
```

### Database Integration (Future)
```python
# Add database for prediction history
from flask_sqlalchemy import SQLAlchemy

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@localhost/frauddb'
db = SQLAlchemy(app)

class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    features = db.Column(db.JSON)
    prediction = db.Column(db.Integer)
    probability = db.Column(db.Float)
```

---

## 10. Rollback Plan

### Version Control
- Tag each deployment: `git tag v1.0.0`
- Maintain separate branches for production
- Keep previous model versions

### Rollback Procedure
```bash
# If deployment fails
# 1. Identify last stable version
git tag

# 2. Checkout stable version
git checkout v1.0.0

# 3. Restore model files
cp backups/model_20260201.pkl fraud_detection_model.pkl

# 4. Restart application
# Heroku:
git push heroku v1.0.0:main --force

# Docker:
docker stop fraud-detection
docker rm fraud-detection
docker run -d -p 5000:5000 fraud-detection:v1.0.0
```

---

## 11. Testing Plan

### Pre-Deployment Testing
- [ ] Unit tests for prediction function
- [ ] Integration tests for API endpoints
- [ ] Load testing with multiple concurrent requests
- [ ] Security testing (SQL injection, XSS)
- [ ] Model performance validation

### Test Scripts
```python
# test_api.py
import requests
import json

def test_prediction():
    url = 'http://localhost:5000/api/predict'
    data = {
        'amount': 250.00,
        'transaction_hour': 14,
        'merchant_category': 'Electronics',
        'foreign_transaction': 0,
        'location_mismatch': 0,
        'device_trust_score': 75,
        'velocity_last_24h': 3,
        'cardholder_age': 35
    }
    
    response = requests.post(url, json=data)
    assert response.status_code == 200
    result = response.json()
    assert 'is_fraud' in result
    assert 'fraud_probability' in result
    print("✓ API test passed")

if __name__ == '__main__':
    test_prediction()
```

---

## 12. Documentation Updates

### Post-Deployment
- Update README with production URL
- Document API endpoints with examples
- Create user guide for web interface
- Maintain changelog

### API Documentation Example
```markdown
## API Endpoints

### POST /api/predict
Predict fraud for single transaction

**Request:**
```json
{
  "amount": 250.00,
  "transaction_hour": 14,
  ...
}
```

**Response:**
```json
{
  "is_fraud": 0,
  "fraud_probability": 0.23,
  "risk_level": "LOW"
}
```
```

---

## 13. Support and Maintenance Contact

### Technical Support
- **Email:** [your-email@example.com]
- **GitHub Issues:** [repository-url]/issues
- **Documentation:** [docs-url]

### Escalation Path
1. Level 1: Check documentation and logs
2. Level 2: Contact technical support
3. Level 3: Consult with ML engineer/supervisor

---

## Deployment Checklist

### Pre-Deployment
- [ ] Code reviewed and tested
- [ ] Model trained and validated
- [ ] Dependencies documented in requirements.txt
- [ ] Environment variables configured
- [ ] Security measures implemented
- [ ] Backup plan established

### Deployment
- [ ] Application deployed successfully
- [ ] Health checks passing
- [ ] API endpoints accessible
- [ ] Web interface functional
- [ ] SSL certificate installed (production)
- [ ] Monitoring enabled

### Post-Deployment
- [ ] Smoke tests completed
- [ ] Performance metrics baseline established
- [ ] Documentation updated
- [ ] Stakeholders notified
- [ ] Rollback plan tested
- [ ] Support team briefed

---

**Deployment Plan Version:** 1.0  
**Last Updated:** February 2026  
**Next Review Date:** March 2026
