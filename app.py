from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import pickle
from collections import Counter
import json

app = Flask(__name__)

# --- LOAD MODELS & DATA ---
with open('models/disease_model.pkl', 'rb') as f:
    data = pickle.load(f)
    model = data['model']
    all_symptoms = data['symptoms']

descriptions_df = pd.read_csv('data/symptom_Description.csv')
descriptions_df['Disease'] = descriptions_df['Disease'].str.strip()

precautions_df = pd.read_csv('data/symptom_precaution.csv')
precautions_df['Disease'] = precautions_df['Disease'].str.strip()

severity_df = pd.read_csv('data/Symptom-severity.csv')
severity_df['Symptom'] = severity_df['Symptom'].str.strip()
severity_dict = dict(zip(severity_df['Symptom'], severity_df['weight']))

df = pd.read_csv('data/dataset.csv')
cols = [i for i in df.columns if i != 'Disease']
for col in cols:
    df[col] = df[col].astype(str).str.strip()

@app.route('/')
def home():
    sorted_symptoms = sorted([s for s in all_symptoms])
    # Create a dictionary of { "original_symptom": "Pretty Symptom" }
    symptom_dict = {s: s.replace('_', ' ').title() for s in sorted_symptoms}
    return render_template('index.html', symptoms=symptom_dict)

@app.route('/get_related', methods=['POST'])
def get_related():
    data = request.get_json()
    main_symptom = data.get('symptom')
    
    mask = df.apply(lambda row: main_symptom in row.values, axis=1)
    subset = df[mask]
    all_symps_in_subset = subset[cols].values.flatten()
    related = [s for s in all_symps_in_subset if str(s) != 'nan' and s != main_symptom]
    most_common = [s[0] for s in Counter(related).most_common(5)]
    
    formatted_related = [{"id": s, "label": s.replace('_', ' ').title()} for s in most_common]
    return jsonify(formatted_related)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    selected_symptoms = data.get('symptoms', [])
    selected_symptoms = [s for s in selected_symptoms if s in all_symptoms]

    input_data = np.zeros(len(all_symptoms))
    total_severity = 0
    high_risk_flag = False

    for symptom in selected_symptoms:
        index = all_symptoms.index(symptom)
        input_data[index] = 1
        
        weight = severity_dict.get(symptom, 0)
        total_severity += weight
        if weight >= 6: 
            high_risk_flag = True

    if total_severity >= 15:
        high_risk_flag = True

    predicted_disease = model.predict([input_data])[0]

    desc_row = descriptions_df[descriptions_df['Disease'] == predicted_disease]
    description = desc_row['Description'].values[0] if not desc_row.empty else "Description not available."

    prec_row = precautions_df[precautions_df['Disease'] == predicted_disease]
    if not prec_row.empty:
        precautions = [prec_row['Precaution_1'].values[0], prec_row['Precaution_2'].values[0], 
                       prec_row['Precaution_3'].values[0], prec_row['Precaution_4'].values[0]]
        precautions = [str(p).title() for p in precautions if str(p) != 'nan']
    else:
        precautions = ["Consult a doctor for accurate advice."]

    return jsonify({
        'disease': predicted_disease,
        'description': description,
        'precautions': precautions,
        'high_risk': high_risk_flag
    })

if __name__ == '__main__':
    app.run(debug=True)