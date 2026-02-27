import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import json
from datetime import date
from typing import List
import io
import base64
from html import escape

# For generating charts
try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

from . import schemas


def generate_pie_chart_base64(data: dict, title: str) -> str:
    """Generate a pie chart and return as base64 string"""
    if not HAS_MATPLOTLIB or not data:
        return ""

    fig, ax = plt.subplots(figsize=(8, 6))
    labels = list(data.keys())
    sizes = list(data.values())
    colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']

    ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, colors=colors[:len(labels)])
    ax.axis('equal')
    ax.set_title(title)

    # Save to bytes buffer
    buffer = io.BytesIO()
    plt.savefig(buffer, format='png', bbox_inches='tight')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.read()).decode()
    plt.close(fig)

    return f"data:image/png;base64,{image_base64}"


def generate_report_html(statistics: schemas.PeriodStatistics, include_charts: bool = True) -> str:
    """Generate HTML report from statistics"""

    # Generate chart if matplotlib is available
    chart_data_url = ""
    if include_charts and HAS_MATPLOTLIB and statistics.expenses_by_category:
        chart_data_url = generate_pie_chart_base64(
            statistics.expenses_by_category,
            "Spese per Categoria"
        )

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }}
            .header {{
                background-color: #1976d2;
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
            }}
            .card {{
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            th, td {{
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }}
            th {{
                background-color: #1976d2;
                color: white;
            }}
            .summary-grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }}
            .summary-item {{
                padding: 15px;
                background-color: #f0f7ff;
                border-radius: 4px;
            }}
            .summary-item strong {{
                color: #1976d2;
            }}
            .chart-container {{
                text-align: center;
                margin: 20px 0;
            }}
            .chart-container img {{
                max-width: 100%;
                height: auto;
            }}
            .muted {{
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Report Spese Familiari</h1>
            <p>Periodo: {statistics.start_date.strftime('%d/%m/%Y')} - {statistics.end_date.strftime('%d/%m/%Y')}</p>
        </div>

        <div class="card">
            <h2>Riepilogo Generale</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <strong>Totale Spese:</strong><br>
                    € {statistics.total_expenses:.2f}
                </div>
                <div class="summary-item">
                    <strong>Numero Transazioni:</strong><br>
                    {statistics.total_transactions}
                </div>
                <div class="summary-item">
                    <strong>Spesa Media:</strong><br>
                    € {statistics.average_transaction:.2f}
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Riepilogo Mese Corrente (Home)</h2>
            <p class="muted">
                Mese: {statistics.current_month_summary.month:02d}/{statistics.current_month_summary.year}
            </p>
            <div class="summary-grid">
                <div class="summary-item">
                    <strong>Entrate Totali:</strong><br>
                    € {statistics.current_month_summary.total_income:.2f}
                </div>
                <div class="summary-item">
                    <strong>Spese Totali:</strong><br>
                    € {statistics.current_month_summary.total_expenses:.2f}
                </div>
                <div class="summary-item">
                    <strong>Saldo:</strong><br>
                    € {statistics.current_month_summary.balance:.2f}
                </div>
            </div>
        </div>

        {'<div class="card"><h2>Grafico Spese per Categoria</h2><div class="chart-container"><img src="' + chart_data_url + '" alt="Grafico Spese"></div></div>' if chart_data_url else ''}

        <div class="card">
            <h2>Spese per Categoria</h2>
            <table>
                <thead>
                    <tr>
                        <th>Categoria</th>
                        <th style="text-align: right;">Importo</th>
                        <th style="text-align: right;">% sul Totale</th>
                    </tr>
                </thead>
                <tbody>
    """

    for category, amount in sorted(statistics.expenses_by_category.items(), key=lambda x: x[1], reverse=True):
        percentage = (amount / statistics.total_expenses * 100) if statistics.total_expenses > 0 else 0
        html += f"""
                    <tr>
                        <td>{escape(category)}</td>
                        <td style="text-align: right;">€ {amount:.2f}</td>
                        <td style="text-align: right;">{percentage:.1f}%</td>
                    </tr>
        """

    html += """
                </tbody>
            </table>
        </div>
    """

    if statistics.current_month_summary.person_contributions:
        html += """
        <div class="card">
            <h2>Contributi Persone (Mese Corrente)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Persona</th>
                        <th style="text-align: right;">Ha anticipato</th>
                        <th style="text-align: right;">Dovra versare</th>
                    </tr>
                </thead>
                <tbody>
        """
        for name, values in statistics.current_month_summary.person_contributions.items():
            html += f"""
                    <tr>
                        <td>{escape(name)}</td>
                        <td style="text-align: right;">€ {values.get("paid", 0.0):.2f}</td>
                        <td style="text-align: right;">€ {values.get("needs_to_pay", 0.0):.2f}</td>
                    </tr>
            """
        html += """
                </tbody>
            </table>
        </div>
        """

    html += """

        <div class="card">
            <h2>Grosse Spese e Investimenti</h2>
    """

    # Add major expenses table
    if statistics.major_expenses:
        html += """
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrizione</th>
                        <th>Categoria</th>
                        <th>Persona</th>
                        <th>Note</th>
                        <th style="text-align: right;">Importo</th>
                    </tr>
                </thead>
                <tbody>
        """
        for exp in statistics.major_expenses:
            notes = escape(exp.notes) if exp.notes else "-"
            html += f"""
                    <tr>
                        <td>{exp.date.strftime("%d/%m/%Y")}</td>
                        <td>{escape(exp.description)}</td>
                        <td>{escape(exp.category)}</td>
                        <td>{escape(exp.person.name)}</td>
                        <td>{notes}</td>
                        <td style="text-align: right;">€ {exp.amount:.2f}</td>
                    </tr>
            """
        html += """
                </tbody>
            </table>
        """
    else:
        html += "<p>Non ci sono grosse spese in questo periodo.</p>"

    html += """
        </div>

        <div class="card">
            <h2>Grossi Anticipi Personali</h2>
            <div class="summary-grid" style="margin-bottom: 20px;">
                <div class="summary-item">
                    <strong>Marco ha anticipato:</strong><br>
    """
    html += f"€ {statistics.marco_advances:.2f}"
    html += """
                </div>
                <div class="summary-item">
                    <strong>Anna ha anticipato:</strong><br>
    """
    html += f"€ {statistics.anna_advances:.2f}"
    html += """
                </div>
            </div>
    """

    # Add Marco's advances details
    if statistics.marco_advance_details:
        html += "<h3>Dettaglio Anticipi Marco</h3>"
        html += """
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrizione</th>
                        <th>Categoria</th>
                        <th style="text-align: right;">Importo</th>
                    </tr>
                </thead>
                <tbody>
        """
        for t in statistics.marco_advance_details:
            description = escape(t.description) if t.description else "-"
            html += f"""
                    <tr>
                        <td>{t.date.strftime("%d/%m/%Y")}</td>
                        <td>{description}</td>
                        <td>{escape(t.category_name)}</td>
                        <td style="text-align: right;">€ {t.amount:.2f}</td>
                    </tr>
            """
        html += """
                </tbody>
            </table>
        """
    else:
        html += "<p>Marco non ha anticipato spese in questo periodo.</p>"

    # Add Anna's advances details
    if statistics.anna_advance_details:
        html += "<h3 style=\"margin-top: 20px;\">Dettaglio Anticipi Anna</h3>"
        html += """
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrizione</th>
                        <th>Categoria</th>
                        <th style="text-align: right;">Importo</th>
                    </tr>
                </thead>
                <tbody>
        """
        for t in statistics.anna_advance_details:
            description = escape(t.description) if t.description else "-"
            html += f"""
                    <tr>
                        <td>{t.date.strftime("%d/%m/%Y")}</td>
                        <td>{description}</td>
                        <td>{escape(t.category_name)}</td>
                        <td style="text-align: right;">€ {t.amount:.2f}</td>
                    </tr>
            """
        html += """
                </tbody>
            </table>
        """
    else:
        html += "<p>Anna non ha anticipato spese in questo periodo.</p>"

    html += """
        </div>

        <div class="card">
            <h2>Recap Finale</h2>
            <h3>Situazione Complessiva Grossi Anticipi</h3>
            <div class="summary-grid" style="margin-bottom: 20px;">
                <div class="summary-item">
                    <strong>Totale Marco:</strong><br>
                    € """ + f"{statistics.large_advances_balance.marco_total:.2f}" + """
                </div>
                <div class="summary-item">
                    <strong>Totale Anna:</strong><br>
                    € """ + f"{statistics.large_advances_balance.anna_total:.2f}" + """
                </div>
                <div class="summary-item">
                    <strong>Totale complessivo:</strong><br>
                    € """ + f"{statistics.large_advances_balance.total_advances:.2f}" + """
                </div>
                <div class="summary-item">
                    <strong>Differenza:</strong><br>
                    € """ + f"{statistics.large_advances_balance.difference:.2f}" + """
                </div>
            </div>

            <h3>Nuove Voci Grosse Spese/Investimenti nel Periodo</h3>
            <p>
                Nuove entry: """ + f"{statistics.new_major_expenses_count}" + """<br>
                Totale nuove entry: € """ + f"{statistics.new_major_expenses_total:.2f}" + """
            </p>
        </div>

        <div class="card" style="background-color: #f0f7ff; text-align: center; padding: 15px;">
            <p style="margin: 0; color: #666;">
                Report generato automaticamente dal Gestionale Famiglia
            </p>
        </div>
    </body>
    </html>
    """

    return html


async def send_email_report(
    smtp_config: dict,
    recipients: List[str],
    subject: str,
    html_content: str
) -> bool:
    """Send email report using SMTP"""

    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = smtp_config.get('username', '')
    message['To'] = ', '.join(recipients)

    # Attach HTML content
    html_part = MIMEText(html_content, 'html')
    message.attach(html_part)

    try:
        # Connect and send
        # Gmail porta 587 usa STARTTLS, non TLS diretto
        await aiosmtplib.send(
            message,
            hostname=smtp_config['server'],
            port=smtp_config['port'],
            username=smtp_config['username'],
            password=smtp_config['password'],
            start_tls=True,  # STARTTLS per porta 587 (Gmail)
        )
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
