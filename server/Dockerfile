FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port 5000
EXPOSE 5000

# Run with Gunicorn for production-like performance, or python for dev
# CMD ["python", "main.py"] 
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"]
