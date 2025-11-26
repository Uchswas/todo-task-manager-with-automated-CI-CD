FROM python:3.11-slim

WORKDIR /app

# Install backend deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Flask config via env vars (set at runtime)
ENV FLASK_APP=run.py
ENV FLASK_ENV=development

EXPOSE 5000

CMD ["python", "run.py"]
