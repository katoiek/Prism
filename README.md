# Prism

A modern desktop application for testing and exploring APIs using OpenAPI/Swagger specifications. Built with Electron, React, and TypeScript.

![Prism Screenshot](public/icon.png)

## Features

- 📄 **OpenAPI/Swagger Support** - Load API specifications from URL or local file
- 🔐 **OAuth2 & API Token Authentication** - Secure connection management with encrypted storage
- 📊 **Table & JSON View** - View API responses in interactive table or raw JSON format
- 📥 **Excel Export** - Export response data to Excel files
- 🤖 **AI Assistant** - Auto-fill request parameters using AI (OpenAI, Anthropic, Google)
- 🌐 **Multi-language Support** - English and Japanese UI

## Verified Integrations

The following APIs have been tested and confirmed to work with Prism:

| Service | OpenAPI Spec |
|---------|--------------|
| **Wrike** | [API v4 Schema Reference](https://developers.wrike.com/apiv4-schema-reference/) |
| **ClickUp** | [Open API Spec](https://developer.clickup.com/docs/open-api-spec) |
| **Notion** | [Unofficial OpenAPI Spec](https://github.com/cameronking4/notion-openapi-chatgpt-action) *(Unofficial)* |

## Installation

### macOS

Download the latest `.dmg` file from the [Releases](https://github.com/your-repo/prism/releases) page.

### Development

```bash
# Clone the repository
git clone https://github.com/your-repo/prism.git
cd prism

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run electron:build
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Desktop**: Electron 40
- **Data Grid**: AG Grid
- **State Management**: Zustand
- **Build**: Vite, electron-builder

## License

MIT

---

# Prism (日本語)

OpenAPI/Swagger仕様を使用してAPIをテスト・探索するためのモダンなデスクトップアプリケーションです。Electron、React、TypeScriptで構築されています。

## 機能

- 📄 **OpenAPI/Swagger対応** - URLまたはローカルファイルからAPI仕様を読み込み
- 🔐 **OAuth2 & APIトークン認証** - 暗号化されたストレージによる安全な接続管理
- 📊 **テーブル & JSONビュー** - APIレスポンスをインタラクティブなテーブルまたは生JSONで表示
- 📥 **Excelエクスポート** - レスポンスデータをExcelファイルにエクスポート
- 🤖 **AIアシスタント** - AIを使用してリクエストパラメータを自動入力（OpenAI、Anthropic、Google対応）
- 🌐 **多言語対応** - 英語と日本語のUI

## 動作確認済みAPI

以下のAPIはPrismでの動作が確認されています：

| サービス | OpenAPI仕様 |
|----------|-------------|
| **Wrike** | [API v4 スキーマリファレンス](https://developers.wrike.com/apiv4-schema-reference/) |
| **ClickUp** | [Open API Spec](https://developer.clickup.com/docs/open-api-spec) |
| **Notion** | [非公式OpenAPI Spec](https://github.com/cameronking4/notion-openapi-chatgpt-action) *(非公式)* |

## インストール

### macOS

[Releases](https://github.com/your-repo/prism/releases)ページから最新の`.dmg`ファイルをダウンロードしてください。

### 開発

```bash
# リポジトリをクローン
git clone https://github.com/your-repo/prism.git
cd prism

# 依存関係をインストール
npm install

# 開発モードで実行
npm run electron:dev

# 本番用にビルド
npm run electron:build
```

## 技術スタック

- **フロントエンド**: React 19、TypeScript、Tailwind CSS
- **デスクトップ**: Electron 40
- **データグリッド**: AG Grid
- **状態管理**: Zustand
- **ビルド**: Vite、electron-builder

## ライセンス

MIT
