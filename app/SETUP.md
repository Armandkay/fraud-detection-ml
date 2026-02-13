# Setup Guide - ML Fraud Detection System

**Quick Start Guide for Initial Setup and Deployment**

---

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [Model Training](#model-training)
4. [Running the Application](#running-the-application)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements
- **Operating System:** Windows 10/11, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **Python:** Version 3.8 or higher
- **RAM:** 4GB minimum (8GB recommended)
- **Disk Space:** 2GB free space
- **Internet:** Required for initial package installation

### Software Prerequisites
- Python 3.8+ ([Download](https://www.python.org/downloads/))
- pip (comes with Python)
- Git (optional, for cloning repository)
- Web browser (Chrome, Firefox, Safari, or Edge)

---

## Installation

### Step 1: Download Project Files

**Option A: Using Git**
```bash
git clone [your-repository-url]
cd fraud-detection-system
```

**Option B: Manual Download**
1. Download ZIP file from repository
2. Extract to desired location
3. Open terminal/command prompt in extracted folder

### Step 2: Create Virtual Environment

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` prefix in your terminal.

### Step 3: Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected Output:**
```
Successfully installed Flask-2.3.0 pandas-2.0.0 numpy-1.24.0 ...
```

**Verification:**
```bash
python -c "import flask, pandas, sklearn; print('✓ All packages installed')"
```

---

## Model Training

### Step 1: Prepare Dataset

Ensure `credit_card_fraud_10k.csv` is in the project root directory.

**Verify:**
```bash
# Windows
dir credit_card_fraud_10k.csv

# macOS/Linux
ls -lh credit_card_fraud_10k.csv
```

### Step 2: Launch Jupyter Notebook

```bash
jupyter notebook
```

This will open Jupyter in your browser.

### Step 3: Train the Model

1. Open `ML_Fraud_Detection_Enhanced.ipynb`
2. Click **Cell** → **Run All** (or use Shift+Enter for each cell)
3. Wait for all cells to complete (5-10 minutes)
4. Verify output files are created:
   - `fraud_detection_model.pkl` (~2MB)
   - `feature_info.pkl` (~1KB)

**Verification:**
```bash
# Windows
dir *.pkl

# macOS/Linux
ls -lh *.pkl
```

You should see both `.pkl` files listed.

### Step 4: Review Model Performance

Check the notebook output for:
- ✓ Model accuracy > 90%
- ✓ F1-score > 0.85
- ✓ ROC-AUC > 0.90

If metrics look good, proceed to running the application.

---

## Running the Application

### Step 1: Start Flask Server

Make sure your virtual environment is activated, then:

```bash
python app.py
```

**Expected Output:**
```
✓ Model loaded successfully
======================================================================
🚀 Starting Fraud Detection Web Application
======================================================================
Access the application at: http://localhost:5000
======================================================================

 * Running on http://0.0.0.0:5000
 * Debug mode: on
```

### Step 2: Access Web Interface

Open your browser and navigate to:
```
http://localhost:5000
```

You should see the Fraud Detection System homepage.

### Step 3: Test a Prediction

1. Fill in the form with sample data:
   - **Amount:** 250.00
   - **Transaction Hour:** 14
   - **Merchant Category:** Electronics
   - **Foreign Transaction:** No
   - **Location Mismatch:** No
   - **Device Trust Score:** 75
   - **Transactions in Last 24h:** 3
   - **Cardholder Age:** 35

2. Click **"Analyze Transaction"**

3. Review the results:
   - Prediction (Fraud/Legitimate)
   - Probability score
   - Risk level
   - Recommended actions

---

## Testing

### Automated API Testing

In a new terminal (keep Flask running in the first terminal):

```bash
# Activate virtual environment
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Run test script
python test_api.py
```

**Expected Output:**
```
✓ PASS: Health Check
✓ PASS: Model Info
✓ PASS: Legitimate Transaction
✓ PASS: Suspicious Transaction
✓ PASS: Batch Prediction
✓ PASS: Error Handling

📊 Results: 6/6 tests passed (100.0%)
🎉 All tests passed! System is ready for deployment.
```

### Manual Testing via Browser

**Test Case 1: Legitimate Transaction**
- Amount: $45.50
- Hour: 14 (2 PM)
- Category: Grocery
- All flags: No
- Trust Score: 85
- Velocity: 2
- Age: 35
- **Expected:** Legitimate, Low Risk

**Test Case 2: Suspicious Transaction**
- Amount: $1500.00
- Hour: 3 (3 AM)
- Category: Electronics
- Foreign: Yes
- Location Mismatch: Yes
- Trust Score: 25
- Velocity: 8
- Age: 22
- **Expected:** Fraud, High Risk

### API Testing with cURL

```bash
curl -X POST http://localhost:5000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 250.00,
    "transaction_hour": 14,
    "merchant_category": "Electronics",
    "foreign_transaction": 0,
    "location_mismatch": 0,
    "device_trust_score": 75,
    "velocity_last_24h": 3,
    "cardholder_age": 35
  }'
```

---

## Troubleshooting

### Issue: "Model file not found"

**Symptoms:**
```
WARNING: Model file not found!
```

**Solution:**
1. Run the Jupyter notebook to train the model
2. Verify `.pkl` files exist in project directory
3. Restart Flask application

---

### Issue: "Module not found" Error

**Symptoms:**
```
ModuleNotFoundError: No module named 'flask'
```

**Solution:**
1. Ensure virtual environment is activated
2. Reinstall dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

### Issue: Port 5000 Already in Use

**Symptoms:**
```
Address already in use
```

**Solution:**

**Windows:**
```bash
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
lsof -ti:5000 | xargs kill -9
```

Or change the port in `app.py`:
```python
app.run(debug=True, host='0.0.0.0', port=5001)  # Use port 5001
```

---

### Issue: Jupyter Notebook Won't Open

**Solution:**
```bash
pip install --upgrade jupyter notebook
jupyter notebook --generate-config
```

---

### Issue: Slow Model Training

**Solution:**
- Close other applications
- Use smaller dataset for testing
- Consider using Google Colab for training

---

### Issue: API Returns 500 Error

**Symptoms:**
```json
{"error": "Prediction failed: ..."}
```

**Solution:**
1. Check Flask terminal for detailed error
2. Verify all input fields are provided
3. Ensure data types are correct
4. Review model compatibility

---

## Quick Reference Commands

### Start Application
```bash
# Activate venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Run app
python app.py
```

### Train Model
```bash
jupyter notebook ML_Fraud_Detection_Enhanced.ipynb
```

### Run Tests
```bash
python test_api.py
```

### Stop Application
Press `Ctrl + C` in the terminal running Flask

---

## Environment Variables (Optional)

Create `.env` file for production:
```env
FLASK_ENV=production
MODEL_PATH=fraud_detection_model.pkl
FEATURE_PATH=feature_info.pkl
PORT=5000
```

Load with:
```bash
pip install python-dotenv
```

---

## Next Steps

After successful setup:

1. ✅ **Test thoroughly** with various transaction scenarios
2. ✅ **Review model metrics** in Jupyter notebook
3. ✅ **Prepare demo video** showing functionality
4. ✅ **Deploy to cloud** (Heroku, AWS, etc.) - see DEPLOYMENT.md
5. ✅ **Document API** for integration

---

## Getting Help

### Resources
- **README.md** - Project overview and documentation
- **DEPLOYMENT.md** - Deployment guide
- **GitHub Issues** - Report bugs or ask questions

### Contact
- **Email:** [your-email]
- **GitHub:** [your-github]

---

## Checklist for Submission

Before submitting your project:

- [ ] Virtual environment created and activated
- [ ] All dependencies installed successfully
- [ ] Dataset file present
- [ ] Model trained (`.pkl` files exist)
- [ ] Flask application runs without errors
- [ ] Web interface accessible at localhost:5000
- [ ] At least 3 test predictions completed successfully
- [ ] API tests passing (test_api.py)
- [ ] Screenshots captured
- [ ] Demo video recorded (5-10 minutes)
- [ ] README updated with your information
- [ ] GitHub repository created and pushed
- [ ] Code zipped for submission

---

**Setup Guide Version:** 1.0  
**Last Updated:** February 2026  
**For:** ALU Mission 5 - ML Track
