
# Stage 1: Build the Clarity worker
FROM maven:3.9-eclipse-temurin-21 AS clarity-build

WORKDIR /build

COPY clarity-worker/pom.xml ./pom.xml
COPY clarity-worker/src ./src

RUN mvn -B -DskipTests package

# Stage 2: Python API + Java runtime
FROM python:3.12-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openjdk-21-jre-headless \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY --from=clarity-build /build/target/clarity-worker.jar /app/clarity-worker.jar

ENV REPLAY_PARSER_COMMAND="java -jar /app/clarity-worker.jar {file} {output}"

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}"]
