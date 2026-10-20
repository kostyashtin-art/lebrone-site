# Build the Clarity adapter with Java 17 and package its dependencies into one JAR.
FROM maven:3.9-eclipse-temurin-17 AS clarity-build
WORKDIR /build
COPY clarity-worker/pom.xml ./pom.xml
COPY clarity-worker/src ./src
RUN mvn -q -DskipTests package

# Python API + Java runtime: FastAPI calls the local, fixed Clarity worker.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY --from=clarity-build /build/target/clarity-worker.jar /app/clarity-worker.jar
ENV PORT=8000
ENV REPLAY_PARSER_COMMAND="java -jar /app/clarity-worker.jar {file} {output}"
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
