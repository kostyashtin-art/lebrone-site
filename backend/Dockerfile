
# Stage 1: Build the Clarity Java worker
FROM maven:3.9-eclipse-temurin-21 AS java-builder

WORKDIR /build

COPY clarity-worker/pom.xml ./pom.xml
COPY clarity-worker/src ./src

RUN mvn -B -DskipTests clean package

# Verify that Maven produced the executable JAR
RUN echo "=== JAR FILES ===" \
    && find /build/target -maxdepth 1 -type f -name '*.jar' -print \
    && test -f /build/target/clarity-worker.jar \
    && echo "=== VERIFY EXECUTABLE JAR ===" \
    && java -jar /build/target/clarity-worker.jar; status=$?; \
       if [ "$status" -ne 2 ]; then \
           echo "ERROR: clarity-worker.jar failed startup validation (exit code $status)"; \
           exit 1; \
       fi

# Stage 2: Run the Python API and Java worker
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

COPY --from=java-builder /build/target/clarity-worker.jar /app/clarity-worker.jar
COPY app.py .

ENV REPLAY_PARSER_COMMAND="java -jar /app/clarity-worker.jar {file} {output}"

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}"]

