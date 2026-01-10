FROM python:3.11-slim

# Install system dependencies for multi-language support (C++, Java, Go, Rust, Node.js)
RUN apt-get update && apt-get install -y \
    build-essential \
    default-jdk \
    golang-go \
    rustc \
    cargo \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app
ENV PYTHONPATH=/app

# Smart Terminal: Add custom bashrc
RUN echo "export PS1='\[\033[01;32m\]\u@agentforge\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '" >> /root/.bashrc && \
    echo "alias ll='ls -alF'" >> /root/.bashrc && \
    echo "alias l='ls -CF'" >> /root/.bashrc && \
    echo "alias pip='pip --no-cache-dir'" >> /root/.bashrc

RUN mkdir -p /app/workspace && chmod 777 /app/workspace

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . .

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run app.py when the container launches
# Run app.py when the container launches
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
