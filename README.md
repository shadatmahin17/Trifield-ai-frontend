# Trifield AI Frontend

> An open-source, budget-friendly frontend designed to streamline academic research workflows.

## 📌 Objectives

* **Paper Discovery & Retrieval:** Search for open-access academic literature and directly download PDF files.
* **Interactive PDF Chat:** Conversational interface powered by Retrieval-Augmented Generation (RAG) to analyze, summarize, and query paper contents.
* **Cost-Effective Research:** Engineered to minimize API consumption, making high-level AI research tools accessible at low or zero cost.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18.0 or higher)
* npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/trifield-ai-frontend.git](https://github.com/your-username/trifield-ai-frontend.git)
   cd trifield-ai-frontend

```

2. **Install dependencies:**
```bash
npm install

```


3. **Set up environment variables:**
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

```


4. **Run the development server:**
```bash
npm run dev

```


Open `http://localhost:3000` in your browser.

---

## 🛠️ Key Features

| Feature | Description |
| --- | --- |
| **Search Engine Integration** | Fetch papers directly via Semantic Scholar, arXiv, or Unpaywall APIs. |
| **In-Browser PDF Reader** | Side-by-side reading view with integrated text selection and inline chat. |
| **Contextual Q&A** | Query specific sections of uploaded or downloaded PDFs using local embeddings. |
| **Budget Mode** | Optimized prompt length and caching layers to drastically reduce LLM API billing. |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to open an Issue or submit a Pull Request.

## 📄 License

This project is licensed under the [MIT License](https://www.google.com/search?q=LICENSE).

