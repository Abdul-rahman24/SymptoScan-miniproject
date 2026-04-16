import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle
import os

print("Loading datasets...")
# Load the dataset
df = pd.read_csv('data/dataset.csv')
severity_df = pd.read_csv('data/Symptom-severity.csv')

# Clean symptom strings (remove extra spaces)
cols = [i for i in df.columns if i != 'Disease']
for col in cols:
    df[col] = df[col].astype(str).str.strip()

severity_df['Symptom'] = severity_df['Symptom'].str.strip()
all_symptoms = severity_df['Symptom'].tolist()

print("Transforming dataset into binary format (this may take a few seconds)...")
# Create a binary matrix
X = pd.DataFrame(0, index=np.arange(len(df)), columns=all_symptoms)
y = df['Disease'].str.strip()

for i, row in df.iterrows():
    for col in cols:
        symptom = row[col]
        if symptom != 'nan' and symptom in all_symptoms:
            X.at[i, symptom] = 1

# Train-Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training Random Forest Model...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Ensure the models folder exists
os.makedirs('models', exist_ok=True)

# Save the trained model and the symptom list
print("Saving model to models/disease_model.pkl...")
with open('models/disease_model.pkl', 'wb') as f:
    pickle.dump({'model': model, 'symptoms': all_symptoms}, f)

print("Training Complete! Accuracy on test set:", model.score(X_test, y_test))