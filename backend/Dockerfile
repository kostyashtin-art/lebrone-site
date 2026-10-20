
# Stage 1: Build the Clarity Java worker
FROM maven:3.9-eclipse-temurin-21 AS java-builder

WORKDIR /build

# Copy the Clarity project sources
COPY clarity-worker/pom.xml ./pom.xml
COPY clarity-worker/src ./src

RUN mvn -B -DskipTests package

RUN echo "=== JAR FILES ===" \
    && find /build/target -maxdepth 1 -type f -name '*.jar' -print \
    && echo "=== MANIFEST ===" \
    && unzip -p /build/target/clarity-worker.jar META-INF/MANIFEST.MF

# Stage 2: Python API + Java runtime
FROM python:3.12-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openjdk-21-jre-headless \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the built Java worker
COPY --from=java-builder /build/target/*.jar /app/clarity-worker.jar

# Copy the Python API
COPY app.py .

ENV REPLAY_PARSER_COMMAND="java -jar /app/clarity-worker.jar {file} {output}"

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}"]
