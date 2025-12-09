
# Peinture (AI Image Gen)

![Stars](https://img.shields.io/github/stars/Amery2010/peinture?style=flat-square)
![Forks](https://img.shields.io/github/forks/Amery2010/peinture?style=flat-square)
![Issues](https://img.shields.io/github/issues/Amery2010/peinture?style=flat-square)

A sleek, dark-themed AI image generator built with React, TypeScript, and Tailwind CSS. This application leverages powerful generative models from **Hugging Face**, **Gitee AI**, and **Model Scope** to create high-quality images from text prompts in seconds.

![App Screenshot](https://cdn.u14.app/upload/WX20251209-170748@2x.png)

## ✨ Features

- **Triple AI Providers**: Seamlessly switch between **Hugging Face**, **Gitee AI**, and **Model Scope** providers to access different model ecosystems and quotas.
- **Multi-Model Support**: Access diverse models including:
  - Hugging Face: `Z-Image Turbo`, `Qwen Image Fast`, `Ovis Image`
  - Gitee AI: `Z-Image Turbo`, `Qwen Image`
  - Model Scope: `Z-Image Turbo`
- **Prompt Optimization**: Integrated AI prompt enhancer that expands simple ideas into detailed, cinematic descriptions (powered by Pollinations.ai for HF, Qwen3 for Gitee, and DeepSeek-V3 for Model Scope).
- **Advanced Controls**: Fine-tune your creations with adjustable **inference steps**, **seed control**, and **HD Mode** (High Definition).
- **History Gallery**: Automatically saves generated images locally. View, zoom, pan, and manage your creation history.
- **4x Resolution**: AI upscaling technology to increase image resolution up to 4x (Supported on Hugging Face).
- **Multilingual**: Full support for English and Chinese (中文) interfaces.
- **Token Management**: Configure personal API tokens for higher rate limits and stability.
- **Privacy Focused**: History is stored in your browser's LocalStorage; no backend database is required for user data.

## 🛠 Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Animation**: CSS Transitions & Tailwind
- **APIs**:
  - **Hugging Face Inference API**
  - **Gitee AI API**
  - **Model Scope API**
  - **Pollinations.ai**

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Amery2010/peinture.git
   cd peinture
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

## 📦 Deployment

This project is a static Single Page Application (SPA), making it easy to deploy on any platform that supports static hosting.

### Option 1: Vercel (Recommended)

Vercel is optimized for frontend frameworks and requires zero configuration.

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Run the deploy command from the project root:
   ```bash
   vercel
   ```

3. Follow the prompts. Vercel will automatically detect Vite and set the build command to `npm run build` and the output directory to `dist`.

**Alternatively, via the Vercel Dashboard:**
1. Push your code to GitHub.
2. Import the repository in Vercel.
3. Keep the default "Framework Preset" as `Vite`.
4. Click **Deploy**.

### Option 2: Cloudflare Pages

Cloudflare Pages is the best way to host static assets on the Cloudflare network.

1. Push your code to a GitHub repository.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Compute (Workers & Pages)** > **Create Application** > **Pages** > **Connect to Git**.
3. Select your repository.
4. In "Build settings":
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **Save and Deploy**.

### Option 3: Static CDN (Nginx, Apache, Netlify, S3)

To host on any standard web server or CDN:

1. Build the project locally:
   ```bash
   npm run build
   ```

2. This will generate a `dist` folder containing `index.html` and bundled assets.

3. Upload the **contents** of the `dist` folder to your server's public root directory (e.g., `/var/www/html` or an S3 bucket).

4. **Important for SPAs**: Ensure your server is configured to redirect all 404 requests to `index.html` so that React Router (if added in the future) or client-side logic handles the routing.

## ⚙️ Configuration

You can configure API tokens in the app's **Settings** menu.

### Hugging Face Token (Optional)
The application works out-of-the-box using public quotas. However, for heavy usage or during peak times, providing your own token is recommended.
1. Get a token from [Hugging Face Settings](https://huggingface.co/settings/tokens).
2. Paste it into the **Hugging Face Token** field in Settings.

### Gitee AI Token (Required for Gitee)
To use the Gitee AI provider, you must provide an API token.
1. Get a token from [Gitee AI Dashboard](https://ai.gitee.com/dashboard/settings/tokens).
2. Paste it into the **Gitee AI Token** field in Settings.
3. Gitee AI provides a daily free quota for generated images.

### Model Scope Token (Required for Model Scope)
To use the Model Scope provider, you must provide an API token.
1. Get a token from [Model Scope Dashboard](https://modelscope.cn/my/myaccesstoken).
2. Paste it into the **Model Scope Token** field in Settings.

*Tokens are stored securely in your browser's `localStorage` and are strictly used to authenticate requests to the respective Inference endpoints.*

## ❓ FAQ

**Q: Is this service free to use?**
A: Yes, this project is completely free. It defaults to using public API quotas. Due to potential limits on public quotas during peak times, you can configure your own Hugging Face token in the settings for a more stable generation experience and higher usage quotas. Gitee AI and Model Scope require you to provide a token to use their free quotas.

**Q: Is my data and privacy safe?**
A: Absolutely. We prioritize privacy. All generation history, settings, and tokens are stored locally in your browser (LocalStorage). We do not have a backend database, and we do not collect your personal usage data. Please note: Generated images are kept for 24 hours, so be sure to download your favorites. Prompt history is temporary and clears when you close the page.

**Q: How does the multi-token system work?**
A: You can enter multiple tokens separated by commas. The system automatically creates a pool. If the current token exhausts its daily quota, the system will automatically mark it as exhausted for the day and seamlessly switch to the next available token, ensuring your creation is uninterrupted. This mechanism applies to Hugging Face, Gitee AI, and Model Scope.

**Q: Which services power this app?**
A: Image generation for Hugging Face is powered by Hugging Face, and prompt optimization is provided by Pollinations.ai. Image generation and prompt optimization for Gitee AI are provided by Gitee AI. Image generation and prompt optimization for Model Scope are provided by Model Scope.

**Q: Can I host this myself?**
A: Yes! This is an open-source project licensed under MIT. You can fork the repository from GitHub and deploy it to Vercel, Cloudflare Pages, or any static hosting service.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License.