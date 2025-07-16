import pandas as pd

# Load data from the given CSV file
FILE_PATH = 'temp_uploads/fcaf66c9-e150-4a5c-9354-0f8d7ff50ab6.csv'
df = pd.read_csv(FILE_PATH)

# Ensure necessary columns are numeric
for col in ['Personalkosten_2024', 'FTE_2024']:
    if df[col].dtype == 'object':
        df[col] = df[col].str.replace('[€,.]', '', regex=True).str.replace(',', '.', regex=False)
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

# Calculate Personalkosten pro FTE CORRECTLY
if 'FTE_2024' in df.columns and 'Personalkosten_2024' in df.columns:
    # CORRECT METHOD: First sum, then divide on group level
    grouped_df = df.groupby('Mitarbeitergruppe').agg({
        'Personalkosten_2024': 'sum',
        'FTE_2024': 'sum'
    }).reset_index()
    
    # Now divide the sums (avoiding division by zero)
    grouped_df['Personalkosten_pro_FTE'] = grouped_df['Personalkosten_2024'] / grouped_df['FTE_2024']
    grouped_df['Personalkosten_pro_FTE'] = grouped_df['Personalkosten_pro_FTE'].fillna(0)
    
    # Keep only the required columns and sort
    result_df = grouped_df[['Mitarbeitergruppe', 'Personalkosten_pro_FTE']].sort_values(by='Personalkosten_pro_FTE', ascending=False)
    
    print(result_df.to_json(orient='split', index=False))
else:
    print(pd.DataFrame().to_json(orient='split', index=False))
