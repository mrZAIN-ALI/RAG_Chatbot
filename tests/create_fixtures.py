"""Generate deterministic integration-test fixtures for DocMind."""

from pathlib import Path
from textwrap import wrap

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
SAMPLE_PDF = FIXTURES_DIR / "sample.pdf"

PAGE_ONE_PARAGRAPHS = [
    (
        "DocMind return policy allows customers to return unused physical products within 30 "
        "calendar days of delivery. The item must include the original receipt and all standard "
        "packaging materials to qualify for a refund."
    ),
    (
        "Digital downloads, activation keys, and custom setup services are non-refundable once "
        "they have been delivered or accessed. If a shipment arrives damaged, customers must "
        "contact support within 72 hours so the team can arrange a replacement."
    ),
]

PAGE_TWO_PARAGRAPHS = [
    (
        "Approved refunds are sent back to the original payment method within 5 business days "
        "after the returned package is inspected. Store credit may be offered instead of a card "
        "refund when the customer prefers a faster resolution."
    ),
]


def _draw_paragraph(pdf: canvas.Canvas, text: str, x: int, y: int, width_chars: int = 82) -> int:
    """Draw one wrapped paragraph and return the next vertical cursor position."""
    cursor_y = y
    for line in wrap(text, width=width_chars):
        pdf.drawString(x, cursor_y, line)
        cursor_y -= 16
    return cursor_y - 14


def build_sample_pdf(output_path: Path) -> Path:
    """Create the sample two-page PDF fixture used by integration tests."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    pdf = canvas.Canvas(str(output_path), pagesize=letter)
    width, height = letter

    pdf.setTitle("DocMind Return Policy Fixture")
    pdf.setFont("Helvetica", 12)

    cursor_y = height - 72
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(72, cursor_y, "DocMind Return Policy")
    cursor_y -= 34
    pdf.setFont("Helvetica", 12)

    for paragraph in PAGE_ONE_PARAGRAPHS:
        cursor_y = _draw_paragraph(pdf, paragraph, 72, cursor_y)

    pdf.showPage()
    cursor_y = height - 72
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(72, cursor_y, "Refund Processing")
    cursor_y -= 34
    pdf.setFont("Helvetica", 12)

    for paragraph in PAGE_TWO_PARAGRAPHS:
        cursor_y = _draw_paragraph(pdf, paragraph, 72, cursor_y)

    pdf.save()
    return output_path


if __name__ == "__main__":
    created = build_sample_pdf(SAMPLE_PDF)
    print(f"Created fixture: {created}")
