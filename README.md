# FreeSearch

A privacy-focused, self-hosted AI search engine that combines web search with local LLM inference. Get AI-powered answers with cited sources, all running on your own hardware.

## Features

- **Local LLM Inference** - Uses llama.cpp for fast, private AI responses
- **Web Search Integration** - SearXNG meta-search engine for comprehensive results
- **Source Citations** - Every answer includes numbered references to sources
- **Conversation Memory** - Follow-up questions understand context
- **Smart Query Detection** - Automatically determines when web search is needed
- **Real-time Streaming** - See responses as they generate
- **Chat History** - Persistent conversations stored locally in SQLite
- **Dark Mode UI** - Clean, modern interface inspired by Perplexity

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **AI**: Vercel AI SDK, LangChain
- **LLM Backend**: llama.cpp (OpenAI-compatible API)
- **Search**: SearXNG
- **Database**: SQLite with Prisma ORM
- **UI Components**: shadcn/ui, Radix UI

## Hardware Requirements

| Component | Minimum |
|-----------|---------|
| GPU VRAM | 4 GB |
| System RAM | 8 GB |

A CUDA-compatible NVIDIA GPU is recommended for optimal performance.

## Quick Start with Docker (Recommended)

The easiest way to run FreeSearch is with Docker. It sets up everything automatically.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- A GGUF model file (e.g., [Qwen3-4B](https://huggingface.co/unsloth/Qwen3-4B-GGUF))
- **For GPU acceleration:**
  - **Windows:** Automatic with Docker Desktop + WSL2 (just need updated NVIDIA drivers)
  - **Linux:** Requires NVIDIA Container Toolkit (see below)
  - **macOS:** Not supported, use CPU-only mode

#### Linux GPU Setup (Ubuntu/Debian)

```bash
# Install prerequisites
sudo apt-get update && sudo apt-get install -y --no-install-recommends \
   curl \
   gnupg2

# Configure the repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Update and install
sudo apt-get update
export NVIDIA_CONTAINER_TOOLKIT_VERSION=1.18.2-1
  sudo apt-get install -y \
      nvidia-container-toolkit=${NVIDIA_CONTAINER_TOOLKIT_VERSION} \
      nvidia-container-toolkit-base=${NVIDIA_CONTAINER_TOOLKIT_VERSION} \
      libnvidia-container-tools=${NVIDIA_CONTAINER_TOOLKIT_VERSION} \
      libnvidia-container1=${NVIDIA_CONTAINER_TOOLKIT_VERSION}

# Configure Docker runtime
sudo nvidia-ctk runtime configure --runtime=docker

# Restart Docker
sudo systemctl restart docker
```

For other Linux distributions, see the [NVIDIA Container Toolkit Install Guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).

### Steps

1. **Clone and add your model**
   ```bash
   git clone https://github.com/RajaXSharma/freeSearch.git
   cd freesearch

   # Download a model to the model/ folder
   # Example: wget -P model/ https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf
   ```

2. **Update model filename** (if different)

   Edit `docker-compose.yml` line ~65 to match your model filename:
   ```yaml
   --model /models/YOUR-MODEL-NAME.gguf
   ```

3. **Start everything**
   ```bash
   docker compose up -d --build
   ```

4. **Open** [http://localhost:3000](http://localhost:3000)

### Docker Commands

```bash
docker compose up -d --build   # Start all services
docker compose logs -f         # View logs
docker compose down            # Stop all services
docker compose down -v         # Stop and delete data
```

---

## Manual Installation

If you prefer not to use Docker, follow the manual setup below.

### Prerequisites

You need two services running locally:

### 1. SearXNG (Meta Search Engine)

```bash
# Using Docker (recommended)
# Run from the project root directory (where searxng/ folder is located)
docker run -d \
  --name searxng \
  -p 8888:8080 \
  -v "$(pwd)/searxng/settings.yml:/etc/searxng/settings.yml" \
  -e SEARXNG_BASE_URL=http://localhost:8888/ \
  searxng/searxng
```

The `searxng/settings.yml` file is included in this repository with JSON API enabled.

### 2. llama.cpp (LLM Server)

```bash
# Download and build llama.cpp
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
cmake -B build -DGGML_CUDA=ON
cmake --build build --config Release -j 8

# Download a model (example: Qwen3-4B)
# Place .gguf files in the model/ directory

# Start the server with jinja support (required for tool calling)
./build/bin/llama-server -m /path/to/model.gguf -ngl 99 -c 4096 --port 8080 --jinja
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RajaXSharma/freeSearch.git
   cd freesearch/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

4. **Initialize database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open** [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter your question in the search bar
2. FreeSearch will:
   - Analyze if web search is needed
   - Search the web via SearXNG (if applicable)
   - Generate an AI response with source citations
3. Ask follow-up questions - the AI maintains conversation context
4. Click source cards to visit original websites

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/chat/        # Chat streaming API
│   │   └── chat/[id]/       # Chat page
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── answer-section.tsx
│   │   ├── search-input.tsx
│   │   ├── sidebar.tsx
│   │   └── source-card.tsx
│   ├── lib/
│   │   ├── llm.ts           # LLM configuration & prompts
│   │   ├── searxng.ts       # Web search integration
│   │   └── db.ts            # Database client
│   └── generated/prisma/    # Prisma client (generated)
├── prisma/
│   └── schema.prisma        # Database schema
└── package.json
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEARXNG_URL` | `http://localhost:8888` | SearXNG instance URL |
| `LLAMA_API_URL` | `http://localhost:8080/v1` | llama.cpp server URL |

### Recommended Models

Any GGUF model compatible with llama.cpp works. Tested with:
- [Qwen3-4B](https://huggingface.co/unsloth/Qwen3-4B-GGUF) (good balance of speed/quality)
- Llama 3.2 3B

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Open Prisma Studio (database GUI)
npx prisma studio
```
