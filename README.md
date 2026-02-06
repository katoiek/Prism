# Prism

[🇯🇵 日本語版はこちら](#prism-日本語)

Prism is a modern, high-performance desktop application designed for developers and power users to explore, test, and interact with APIs using OpenAPI (Swagger) specifications. Built on Electron, React 19, and TypeScript, it offers a seamless experience for managing complex API workflows.

<img src="public/icon.png" alt="Prism" width="128" height="128">

## 🌟 Key Features

- 📄 **OpenAPI/Swagger Explorer** - Seamlessly load and browse API specifications from URLs or local files (JSON/YAML).
- 🔐 **Secure Connection Management** - Manage multiple API connections with OAuth2 or API Token authentication. Sensitive data like Client Secrets and Tokens are stored in a secure, encrypted local store.
- 📊 **Dynamic Data Rendering** - View API responses in a powerful AG Grid table or a formatted JSON viewer. Handle large datasets with ease.
- 📥 **Enterprise-ready Export** - Export your API results directly to Excel for further analysis or reporting.
- 🤖 **AI-Powered Request Assistant** - Leverage OpenAI, Anthropic, or Google Gemini to automatically populate request parameters and generate smart payloads.
- 🌐 **Localized Interface** - Full support for both English and Japanese languages.

## 🚀 Verified Integrations

Prism has been tested extensively with major SaaS platforms to ensure compatibility:

| Service | Category | OpenAPI Specification Source |
|---------|----------|------------------------------|
| **Wrike** | Project Management | [Official v4 Schema](https://developers.wrike.com/apiv4-schema-reference/) |
| **ClickUp** | Productivity | [Official Spec](https://developer.clickup.com/docs/open-api-spec) |
| **Notion** | Knowledge Base | [Community maintained Spec](https://github.com/cameronking4/notion-openapi-chatgpt-action) |
| **freee** | ERP/Accounting | Official freee-api-schema |

## 🛠 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/katoiek/Prism.git
cd Prism

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production (macOS)
npm run electron:build
```

## 🤖 AI Assistant Configuration

To use the AI Assistant feature, you need to provide your API keys for the supported providers. Prism stores these keys securely:

1. Navigate to the **Settings** view within the app.
2. Select your preferred provider (**OpenAI**, **Anthropic**, or **Google**).
3. Enter your API key.
4. Go to the **Query** view and use the "AI Assist" button to generate parameters based on the endpoint description.

## 🏗 Tech Stack

- **UI Framework**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Desktop Runtime**: [Electron](https://www.electronjs.org/)
- **Data Grid**: [AG Grid](https://www.ag-grid.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Bundler**: [Vite](https://vitejs.dev/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<a id="prism-日本語"></a>

# Prism (日本語)

Prismは、OpenAPI (Swagger) 仕様を使用してAPIの探索、テスト、連携を行うための、開発者およびパワーユーザー向けのモダンなデスクトップアプリケーションです。Electron、React 19、TypeScriptで構築されており、複雑なAPIワークフローをシームレスに管理できます。

## 🌟 主な機能

- 📄 **OpenAPI/Swagger エクスプローラー** - URLまたはローカルファイル（JSON/YAML）からAPI仕様を簡単に読み込み、閲覧。
- 🔐 **セキュアな接続管理** - OAuth2またはAPIトークン認証を使用した複数のAPI接続を管理。クライアントシークレットやトークンなどの機密データは、暗号化されたローカルストレージに安全に保管されます。
- 📊 **動的なデータレンダリング** - 高機能なAG Gridテーブルまたは整形されたJSONビューでレスポンスを確認。大規模なデータセットもスムーズに処理。
- 📥 **エクスポート機能** - API実行結果をExcel形式で直接出力し、分析やレポート作成に活用可能。
- 🤖 **AIリクエストアシスタント** - OpenAI、Anthropic、Google Geminiと連携し、リクエストパラメータの自動生成やスマートなペイロード構築を支援。
- 🌐 **多言語対応** - 日本語と英語のUIを完全サポート。

## 🚀 動作確認済みプロジェクト

以下の主要なSaaSプラットフォームで動作確認済みです：

| サービス | カテゴリ | OpenAPI仕様ソース |
|----------|----------|-------------------|
| **Wrike** | プロジェクト管理 | [公式 v4 スキーマ](https://developers.wrike.com/apiv4-schema-reference/) |
| **ClickUp** | 生産性ツール | [公式 Spec](https://developer.clickup.com/docs/open-api-spec) |
| **Notion** | ナレッジベース | [コミュニティ維持 Spec](https://github.com/cameronking4/notion-openapi-chatgpt-action) |
| **freee** | ERP/会計 | 公式 freee-api-schema |

## 🛠 はじめかた

### 構成要件

- Node.js (v18以上)
- npm または yarn

### インストールと開発

```bash
# リポジトリをクローン
git clone https://github.com/katoiek/Prism.git
cd Prism

# 依存関係のインストール
npm install

# 開発モードで起動
npm run electron:dev

# 本番用ビルド (macOS)
npm run electron:build
```

## 🤖 AIアシスタントの設定

AIアシスタント機能を使用するには、対応プロバイダーのAPIキーを設定する必要があります：

1. アプリ内の **Settings** ビューを開きます。
2. 利用するプロバイダー（**OpenAI**, **Anthropic**, **Google**）を選択します。
3. APIキーを入力します。
4. **Query** ビューに移動し、「AI Assist」ボタンをクリックして、エンドポイントの概要に基づいたパラメータを自動生成します。

## 🏗 技術スタック

- **UI フレームワーク**: React 19
- **言語**: TypeScript
- **デスクトップランタイム**: Electron
- **データグリッド**: AG Grid
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **ビルドツール**: Vite

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。
