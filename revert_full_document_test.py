#!/usr/bin/env python3
"""
Script to revert the temporary full document test changes in llm.py
This will restore the original chunking behavior for get_answer_from_document function.
"""

import re

def revert_full_document_test():
    """Reverts the temporary full document test changes"""
    
    # Read the current llm.py file
    with open('llm.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Define the original function signature and docstring
    original_docstring = '''async def get_answer_from_document(conversation_history: list, document_content: str, file_type: str = None, last_image_bytes: bytes = None, cancellation_check=lambda: False):
    """
    Generates a streaming answer based on the user's question and the content of an uploaded document (text or image).
    """'''
    
    # Define the original system prompt template (without TEMPORARY modifications)
    original_system_prompt = '''        system_prompt_template = """Sie sind ein Experte für deutsche Jahresabschlüsse und Finanzanalyse. Ihre Aufgabe ist es, die Frage des Benutzers basierend *ausschließlich* auf dem bereitgestellten Dokumenteninhalt zu beantworten.

**KRITISCHE ABKÜRZUNGS-ERKENNUNG:**
- **GuV** = **Gewinn- und Verlustrechnung** (Profit and Loss Statement)
- **BWA** = **Betriebswirtschaftliche Auswertung** (Business Analysis)
- **USt** = **Umsatzsteuer** (VAT)
- **MwSt** = **Mehrwertsteuer** (VAT)
- **EK** = **Eigenkapital** (Equity)
- **FK** = **Fremdkapital** (Debt)
- **EBIT** = **Earnings Before Interest and Taxes**
- **EBITDA** = **Earnings Before Interest, Taxes, Depreciation and Amortization**
- Wenn der Benutzer nach "GuV" fragt, meint er "Gewinn- und Verlustrechnung"
- Wenn der Benutzer nach "BWA" fragt, meint er "Betriebswirtschaftliche Auswertung"

**SPEZIELLE ANWEISUNGEN FÜR TABELLEN UND FINANZDATEN:**
- Wenn Sie Tabellendaten sehen, analysieren Sie ALLE Zeilen und Spalten sorgfältig
- Suchen Sie nach Mustern und Zusammenhängen zwischen verschiedenen Tabellenteilen
- Bei der GuV: Achten Sie auf Umsatzerlöse, Kosten, Ergebnisse und deren Entwicklung
- Kombinieren Sie Informationen aus verschiedenen Dokumententeilen
- Erklären Sie die Bedeutung der Zahlen im Geschäftskontext
- Analysieren Sie Trends und Veränderungen zwischen Perioden
- Suchen Sie nach Zahlen, Beträgen und finanziellen Kennzahlen im gesamten Dokument

**ANWEISUNGEN:**
- **Verwenden Sie keine externen Kenntnisse oder Informationen außerhalb des Dokuments.**
- Wenn die Antwort nicht im Dokument gefunden werden kann, geben Sie das klar an.
- Analysieren Sie die Frage des Benutzers im Kontext der Unterhaltung.
- Erstellen Sie eine schön formatierte Markdown-Antwort mit Aufzählungspunkten.
- Sie MÜSSEN präzise sein, wenn Sie den Dokumenteninhalt analysieren und die Frage beantworten. Lesen Sie den gesamten Inhalt sorgfältig.
- Sie MÜSSEN alle Daten und Informationen im Dokument aufmerksam und fokussiert lesen und dann die Frage beantworten.
- Beantworten Sie die Frage direkt und fügen Sie nicht zu viele zusätzliche Informationen hinzu.
- **Sprache:** Sie MÜSSEN in derselben Sprache antworten, die der Benutzer in seiner Frage verwendet hat.

**Dokumenteninhalt:**
---
{document_content}
---
"""'''
    
    # Define the original context calculation logic
    original_context_logic = '''        messages_for_size_check = create_contextual_messages(conversation_history, "")
        conversation_chars = sum(len(m['content']) for m in messages_for_size_check)
        prompt_template_chars = len(system_prompt_template) - len("{document_content}")
        remaining_chars = 512000 - conversation_chars - prompt_template_chars
        final_doc_content = truncate_text(document_content, remaining_chars)'''
    
    # Define the original metadata
    original_metadata = '''        yield {"type": "meta", "data": {"sources": "Source: Uploaded document", "keywords": "N/A", "follow_ups": []}}
        yield {"type": "status", "data": "Formulating a response based on the document..."}'''
    
    # Replace the temporary docstring
    content = re.sub(
        r'async def get_answer_from_document\(.*?\):\s*"""\s*Generates a streaming answer.*?TEMPORARY:.*?"""',
        original_docstring,
        content,
        flags=re.DOTALL
    )
    
    # Replace the temporary status message
    content = content.replace(
        'yield {"type": "status", "data": "TEMPORARY TEST: Using full document content without chunking..."}',
        'yield {"type": "status", "data": "Analyzing question in document context..."}'
    )
    
    # Replace the temporary system prompt template
    content = re.sub(
        r'        # TEMPORARY: Use the FULL document content.*?---\s*"""\s*',
        original_system_prompt + '\n        ',
        content,
        flags=re.DOTALL
    )
    
    # Replace the temporary context calculation
    content = re.sub(
        r'        # TEMPORARY: Calculate available space.*?characters\)"}',
        original_context_logic + '\n\n        system_prompt = system_prompt_template.format(document_content=final_doc_content)\n        messages = create_contextual_messages(conversation_history, system_prompt)\n        \n' + original_metadata,
        content,
        flags=re.DOTALL
    )
    
    # Write the reverted content back
    with open('llm.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Successfully reverted the temporary full document test changes!")
    print("The get_answer_from_document function now uses the original chunking behavior.")

if __name__ == "__main__":
    revert_full_document_test()
