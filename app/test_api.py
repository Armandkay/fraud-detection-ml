"""
API Testing Script for Fraud Detection System

This script tests all API endpoints to ensure proper functionality.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
API_URL = f"{BASE_URL}/api"

# Test data samples
LEGITIMATE_TRANSACTION = {
    "amount": 45.50,
    "transaction_hour": 14,
    "merchant_category": "Grocery",
    "foreign_transaction": 0,
    "location_mismatch": 0,
    "device_trust_score": 85,
    "velocity_last_24h": 2,
    "cardholder_age": 35
}

SUSPICIOUS_TRANSACTION = {
    "amount": 1500.00,
    "transaction_hour": 3,
    "merchant_category": "Electronics",
    "foreign_transaction": 1,
    "location_mismatch": 1,
    "device_trust_score": 25,
    "velocity_last_24h": 8,
    "cardholder_age": 22
}

def print_header(text):
    """Print formatted header"""
    print("\n" + "="*70)
    print(f"  {text}")
    print("="*70)

def print_result(success, message):
    """Print test result"""
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"{status}: {message}")

def test_health_check():
    """Test health check endpoint"""
    print_header("Testing Health Check Endpoint")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Health check endpoint accessible")
            print(f"   Status: {data.get('status')}")
            print(f"   Model Loaded: {data.get('model_loaded')}")
            return True
        else:
            print_result(False, f"Health check failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Health check error: {str(e)}")
        return False

def test_model_info():
    """Test model info endpoint"""
    print_header("Testing Model Info Endpoint")
    
    try:
        response = requests.get(f"{API_URL}/model_info")
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Model info endpoint accessible")
            print(f"   Model Type: {data.get('model_type')}")
            print(f"   Features: {len(data.get('features', []))} features")
            print(f"   Version: {data.get('version')}")
            return True
        else:
            print_result(False, f"Model info failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Model info error: {str(e)}")
        return False

def test_single_prediction(transaction_data, expected_fraud=None):
    """Test single transaction prediction"""
    print_header(f"Testing Single Prediction - {'Suspicious' if expected_fraud else 'Legitimate'}")
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{API_URL}/predict",
            json=transaction_data,
            headers={'Content-Type': 'application/json'}
        )
        response_time = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Prediction successful")
            print(f"   Prediction: {'FRAUD' if data['is_fraud'] == 1 else 'LEGITIMATE'}")
            print(f"   Probability: {data['fraud_probability']:.4f}")
            print(f"   Risk Level: {data['risk_level']}")
            print(f"   Confidence: {data['confidence']:.4f}")
            print(f"   Response Time: {response_time:.2f}ms")
            
            # Validate expected result if provided
            if expected_fraud is not None:
                if data['is_fraud'] == expected_fraud:
                    print_result(True, "Prediction matches expectation")
                else:
                    print_result(False, "Prediction doesn't match expectation")
            
            return True
        else:
            print_result(False, f"Prediction failed with status {response.status_code}")
            print(f"   Error: {response.json().get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print_result(False, f"Prediction error: {str(e)}")
        return False

def test_batch_prediction():
    """Test batch prediction endpoint"""
    print_header("Testing Batch Prediction")
    
    batch_data = {
        "transactions": [
            {**LEGITIMATE_TRANSACTION, "transaction_id": "T001"},
            {**SUSPICIOUS_TRANSACTION, "transaction_id": "T002"},
            {
                "transaction_id": "T003",
                "amount": 75.00,
                "transaction_hour": 10,
                "merchant_category": "Food",
                "foreign_transaction": 0,
                "location_mismatch": 0,
                "device_trust_score": 90,
                "velocity_last_24h": 1,
                "cardholder_age": 45
            }
        ]
    }
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{API_URL}/batch_predict",
            json=batch_data,
            headers={'Content-Type': 'application/json'}
        )
        response_time = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Batch prediction successful")
            print(f"   Total Transactions: {data['total_transactions']}")
            print(f"   Fraud Detected: {data['fraud_detected']}")
            print(f"   Response Time: {response_time:.2f}ms")
            
            print("\n   Individual Results:")
            for pred in data['predictions']:
                tid = pred.get('transaction_id', 'N/A')
                fraud = 'FRAUD' if pred['is_fraud'] == 1 else 'LEGITIMATE'
                prob = pred['fraud_probability']
                risk = pred['risk_level']
                print(f"     {tid}: {fraud} (Prob: {prob:.4f}, Risk: {risk})")
            
            return True
        else:
            print_result(False, f"Batch prediction failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Batch prediction error: {str(e)}")
        return False

def test_invalid_request():
    """Test API with invalid request"""
    print_header("Testing Error Handling")
    
    invalid_data = {
        "amount": 100.00,
        # Missing required fields
    }
    
    try:
        response = requests.post(
            f"{API_URL}/predict",
            json=invalid_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 400:
            print_result(True, "Invalid request properly rejected")
            print(f"   Error Message: {response.json().get('error')}")
            return True
        else:
            print_result(False, "Invalid request not properly handled")
            return False
            
    except Exception as e:
        print_result(False, f"Error handling test failed: {str(e)}")
        return False

def run_all_tests():
    """Run complete test suite"""
    print("\n" + "#"*70)
    print("#" + " "*20 + "API TEST SUITE" + " "*34 + "#")
    print("#" + " "*68 + "#")
    print("#" + "  Fraud Detection System - API Validation Tests" + " "*18 + "#")
    print("#"*70)
    
    print(f"\n📅 Test Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Base URL: {BASE_URL}")
    
    tests = [
        ("Health Check", test_health_check),
        ("Model Info", test_model_info),
        ("Legitimate Transaction", lambda: test_single_prediction(LEGITIMATE_TRANSACTION, 0)),
        ("Suspicious Transaction", lambda: test_single_prediction(SUSPICIOUS_TRANSACTION, 1)),
        ("Batch Prediction", test_batch_prediction),
        ("Error Handling", test_invalid_request)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_result(False, f"{test_name} raised exception: {str(e)}")
            results.append((test_name, False))
    
    # Print summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    success_rate = (passed / total) * 100
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n📊 Results: {passed}/{total} tests passed ({success_rate:.1f}%)")
    
    if passed == total:
        print("\n🎉 All tests passed! System is ready for deployment.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the errors above.")
    
    print("\n" + "#"*70 + "\n")
    
    return passed == total

if __name__ == "__main__":
    print("\n🚀 Starting API Test Suite...")
    print("⚠️  Make sure the Flask application is running at http://localhost:5000\n")
    
    try:
        # Quick check if server is running
        response = requests.get(BASE_URL, timeout=2)
        print("✓ Server is reachable\n")
    except:
        print("✗ ERROR: Cannot connect to server")
        print("   Please start the Flask app with: python app.py")
        print("   Then run this test script again.\n")
        exit(1)
    
    # Run tests
    success = run_all_tests()
    
    # Exit with appropriate code
    exit(0 if success else 1)
