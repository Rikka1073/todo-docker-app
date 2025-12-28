# はじめてのデプロイガイド - コンテナ入門からCI/CD自動化まで

## このガイドについて

このガイドは、**コンテナに触れたことがない方**を対象に、Todoアプリをインターネットにデプロイするまでの手順を丁寧に説明します。

### このガイドで学べること

1. **コンテナとは何か**、なぜ使うのか
2. **Reactアプリ**をVercelにデプロイする方法
3. **HonoバックエンドAPI**をコンテナでCloud Runにデプロイする方法
4. **CI/CD**で自動デプロイの仕組みを作る方法

### 前提知識

- Git の基本的な使い方（add, commit, push）
- ターミナルの基本操作
- JavaScript/TypeScript の基礎知識

---

## 目次

1. [まず理解しよう：開発環境と本番環境の違い](#1-まず理解しよう開発環境と本番環境の違い)
2. [コンテナって何？なぜ使うの？](#2-コンテナって何なぜ使うの)
3. [ステップ1：Reactアプリをデプロイする（Vercel）](#3-ステップ1reactアプリをデプロイするvercel)
4. [ステップ2：HonoバックエンドをCloud Runにデプロイする](#4-ステップ2honoバックエンドをcloud-runにデプロイする)
5. [ステップ3：CI/CDで自動デプロイを設定する](#5-ステップ3cicdで自動デプロイを設定する)
6. [完了確認とテスト](#6-完了確認とテスト)

---

## 1. まず理解しよう：開発環境と本番環境の違い

### 現在の開発環境（あなたのパソコン上）

今あなたは、**開発環境**でアプリを動かしています：

```
あなたのパソコン（ローカル環境）
├── docker-compose up で起動
├── localhost:5173 ← フロントエンド（React）
├── localhost:3000 ← バックエンド（Hono API）
└── PostgreSQL データベース
```

**特徴：**
- 自分のパソコンでのみ動く
- インターネットから誰もアクセスできない
- コードを変更すると即座に反映される（開発に便利）
- `docker-compose.yml` で3つのコンテナを同時に起動している

### 本番環境（インターネット上のサーバー）

これから作るのは、**本番環境**です：

```
インターネット上
├── Vercel ← フロントエンド（React）
│   └── https://your-app.vercel.app （誰でもアクセス可能）
│
├── Cloud Run ← バックエンド（Hono API）
│   └── https://todo-api-xxxxx.run.app （誰でもアクセス可能）
│
└── Cloud SQL ← データベース（PostgreSQL）
```

**特徴：**
- インターネット上のサーバーで動く
- 誰でもURLからアクセスできる
- コードを変更したら再デプロイが必要
- docker-compose は使わず、各サービスを個別にデプロイ

### なぜ分けるの？

| 環境 | 目的 | 使うツール |
|------|------|-----------|
| **開発環境** | コードを書いて試す場所 | docker-compose（複数コンテナを簡単に起動） |
| **本番環境** | ユーザーが実際に使う場所 | Cloud Run（1つのコンテナを安定稼働） |

---

## 2. コンテナって何？なぜ使うの？

### コンテナとは

コンテナは、**アプリとその動作に必要なものすべてを1つの箱に詰めたもの**です。

#### 例え話：引っ越しの段ボール箱

```
段ボール箱の中身:
├── 本（アプリのコード）
├── 本棚（Node.js）
├── 照明（ライブラリ）
└── 説明書（設定ファイル）
```

この箱を開ければ、**どこでも同じように**本棚と照明が使えます。

### コンテナを使うと何が良いの？

#### ❌ コンテナを使わない場合

```
開発者Aのパソコン:
- Node.js 18.0.0
- npm 8.0.0
→ 動く！

開発者Bのパソコン:
- Node.js 20.0.0
- npm 9.0.0
→ エラーが出る...
```

**問題：**環境が違うと動かないことがある

#### ✅ コンテナを使う場合

```
Dockerコンテナ:
- Node.js 18.0.0
- npm 8.0.0
- アプリのコード
- 必要なライブラリ全部

→ どのパソコンでも、どのサーバーでも同じように動く！
```

**メリット：**
1. **再現性**：誰のパソコンでも同じように動く
2. **ポータビリティ**：ローカルで動いたものが本番でも動く
3. **隔離性**：他のアプリと干渉しない

### Docker と docker-compose の違い

#### Docker（コンテナを1つ動かす）

```bash
# 1つのコンテナを起動
docker run my-app
```

#### docker-compose（複数のコンテナをまとめて動かす）

```bash
# 複数のコンテナを一度に起動（開発用）
docker-compose up

→ 3つのコンテナが起動:
  1. フロントエンド（React）
  2. バックエンド（Hono）
  3. データベース（PostgreSQL）
```

**重要：**
- **開発環境**：docker-compose で複数コンテナをまとめて起動（便利）
- **本番環境**：1つのコンテナだけをデプロイ（シンプル）

### このプロジェクトでのコンテナの使い方

```
開発環境（あなたのパソコン）:
docker-compose.yml
├── client（React） ← Dockerコンテナ
├── api（Hono） ← Dockerコンテナ
└── db（PostgreSQL） ← Dockerコンテナ

→ docker-compose up で3つ同時起動

本番環境（Cloud Run）:
todo-api/Dockerfile
└── api（Hono） ← Dockerコンテナ（これだけ）

→ gcloud run deploy で1つだけデプロイ
```

---

## 3. ステップ1：Reactアプリをデプロイする（Vercel）

### Vercelとは

**Vercel** は、フロントエンドアプリを簡単にデプロイできるサービスです。

- GitHubと連携するだけで自動デプロイ
- CDN（世界中のサーバー）で高速配信
- HTTPSも自動設定
- 無料プランで十分使える

### なぜReactはコンテナを使わないの？

Reactアプリは**ビルドすると静的ファイル（HTML/CSS/JS）**になります：

```bash
npm run build

→ dist/
  ├── index.html
  ├── assets/
  │   ├── index-a1b2c3d4.js
  │   └── index-e5f6g7h8.css
  └── ...
```

これらのファイルは、コンテナを使わなくても配信できます。

**フロントエンド vs バックエンド:**

| | フロントエンド（React） | バックエンド（Hono） |
|---|---|---|
| ビルド後 | 静的ファイル | Node.jsサーバーが必要 |
| デプロイ方法 | ファイルを配信するだけ | コンテナで動かす |
| デプロイ先 | Vercel | Cloud Run |

### 3.1 Vercelアカウント作成

1. [Vercel](https://vercel.com) にアクセス
2. "Sign Up" をクリック
3. GitHubアカウントで連携してサインアップ

### 3.2 プロジェクトをインポート

1. Vercel ダッシュボードで「Add New...」→「Project」をクリック
2. GitHubリポジトリ一覧から `todo-docker-app` を選択
3. 「Import」をクリック

### 3.3 ビルド設定

Vercelが自動的に検出しますが、念のため確認：

```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

**「Deploy」をクリック**

### 3.4 デプロイ完了

数分後、デプロイが完了します：

```
✓ Your project has been deployed!

URL: https://todo-docker-app-xxxxx.vercel.app
```

ブラウザでURLを開いて、アプリが表示されることを確認しましょう。

### 3.5 Vercelの認証情報を取得（後で使う）

CI/CD設定で必要になるので、今のうちに取得しておきます。

#### VERCEL_TOKEN

1. Vercel Dashboard → **Settings** → **Tokens**
2. 「Create」をクリック
3. トークン名: `GitHub Actions`
4. Scope: `Full Account`
5. 「Create」をクリック
6. 表示されたトークンをコピー（後で見れないので注意）

#### VERCEL_ORG_ID と VERCEL_PROJECT_ID

1. Vercel Dashboard → あなたのプロジェクトを選択
2. **Settings** → **General** を開く
3. 下にスクロールして以下をコピー:
   - **Project ID**: `prj_xxxxxxxxxxxxx`
   - **Team ID** または **Organization ID**: `team_xxxxxxxxxxxxx`

これらの値は後でGitHub Secretsに登録します。

---

## 4. ステップ2：HonoバックエンドをCloud Runにデプロイする

### Cloud Runとは

**Cloud Run** は、Googleが提供するコンテナ実行サービスです。

**特徴：**
- Dockerコンテナをそのままデプロイできる
- アクセスがないときは自動的に停止（料金節約）
- アクセスが増えると自動的にスケールアップ
- HTTPS URLが自動発行される

### なぜバックエンドはコンテナを使うの？

バックエンドAPI（Hono）は、**常にNode.jsサーバーとして動く必要がある**からです。

```
フロントエンド（React）:
ビルド → HTML/CSS/JS → 配信するだけ

バックエンド（Hono）:
Node.jsサーバー → 常に起動 → APIリクエストに応答
```

コンテナに詰めることで、**Node.js + アプリコード + ライブラリ**をまとめて動かせます。

### 4.1 前提：GCPプロジェクトの準備

#### Google Cloud Platform（GCP）アカウント作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. Googleアカウントでログイン
3. 「プロジェクトを作成」をクリック
4. プロジェクト名: `todo-app`（任意）
5. プロジェクトIDをメモ: `todo-app-xxxxx`

#### 必要なAPIを有効化

Google Cloud Consoleで以下のAPIを有効化します：

1. **Cloud Run API**
   ```
   https://console.cloud.google.com/apis/library/run.googleapis.com
   ```

2. **Artifact Registry API**
   ```
   https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com
   ```

3. **Cloud SQL API**（データベース用）
   ```
   https://console.cloud.google.com/apis/library/sqladmin.googleapis.com
   ```

各ページで「有効にする」をクリックしてください。

### 4.2 gcloud CLIのインストール

ローカルPCでGCPを操作するためのツールをインストールします。

#### macOS

```bash
brew install --cask google-cloud-sdk
```

#### Windows

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) からインストーラーをダウンロード
2. インストーラーを実行

#### 初期設定

```bash
# Google Cloud CLI 初期化
gcloud init

# 表示されるブラウザでログイン
# プロジェクトを選択: todo-app-xxxxx
# リージョンを選択: 30（asia-northeast1 - 東京）
```

### 4.3 Dockerfileの確認

バックエンド用のDockerfileが既に存在します：

```bash
ls todo-api/Dockerfile
```

このファイルが、**Honoアプリをコンテナに詰める設計図**です。

#### Dockerfileの中身を見てみよう

```dockerfile
# Node.js 18のイメージを使用
FROM node:18-alpine AS builder

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonをコピー
COPY package*.json ./

# ライブラリをインストール
RUN npm ci

# アプリのコードをコピー
COPY . .

# Prismaクライアントを生成
RUN npx prisma generate

# ビルド（本番用）
RUN npm run build

# 本番環境用のイメージ
FROM node:18-alpine

WORKDIR /app

# 本番用ライブラリのみインストール
COPY package*.json ./
RUN npm ci --production

# ビルド済みファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# ポート8080で起動
EXPOSE 8080

# アプリを起動
CMD ["node", "dist/index.js"]
```

**これが何をしているか：**

1. Node.js 18をベースにコンテナを作成
2. `package.json` をコピーして、ライブラリをインストール
3. アプリのコードをコピー
4. Prismaクライアントを生成（データベースアクセス用）
5. アプリをビルド
6. ポート8080で起動する準備
7. `node dist/index.js` でアプリを起動

### 4.4 Artifact Registryリポジトリを作成

**Artifact Registry** は、DockerイメージをGCPに保存する場所です。

#### なぜ必要？

```
あなたのパソコン:
Dockerイメージを作成
    ↓
Artifact Registry:
Dockerイメージを保存（GCPのストレージ）
    ↓
Cloud Run:
保存されたイメージを取得して起動
```

#### リポジトリ作成

```bash
gcloud artifacts repositories create todo-api \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Docker repository for todo-api"
```

**コマンドの意味：**
- `todo-api`: リポジトリ名
- `--repository-format=docker`: Dockerイメージを保存
- `--location=asia-northeast1`: 東京リージョン

#### 確認

```bash
gcloud artifacts repositories list --location=asia-northeast1
```

### 4.5 ローカルでDockerイメージをビルド

まず、ローカルPCでDockerイメージを作ってみましょう。

#### プロジェクトIDを環境変数に設定

```bash
# あなたのGCPプロジェクトIDに置き換えてください
export PROJECT_ID="todo-app-xxxxx"
```

#### Dockerイメージをビルド

```bash
cd todo-api

docker build -t asia-northeast1-docker.pkg.dev/$PROJECT_ID/todo-api/todo-api:latest .
```

**コマンドの意味：**
- `docker build`: Dockerイメージを作成
- `-t`: イメージに名前（タグ）を付ける
- `asia-northeast1-docker.pkg.dev/$PROJECT_ID/todo-api/todo-api:latest`:
  - `asia-northeast1-docker.pkg.dev`: Artifact RegistryのURL
  - `$PROJECT_ID`: あなたのGCPプロジェクトID
  - `todo-api`: リポジトリ名
  - `todo-api`: イメージ名
  - `latest`: タグ（最新版という意味）
- `.`: 現在のディレクトリのDockerfileを使う

#### 完了を確認

```bash
docker images | grep todo-api
```

以下のように表示されればOK：

```
asia-northeast1-docker.pkg.dev/todo-app-xxxxx/todo-api/todo-api   latest   abc123def456   2 minutes ago   200MB
```

### 4.6 Dockerイメージを Artifact Registry にプッシュ

#### Docker認証設定

```bash
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```

これで、DockerがArtifact Registryにアクセスできるようになります。

#### イメージをプッシュ

```bash
docker push asia-northeast1-docker.pkg.dev/$PROJECT_ID/todo-api/todo-api:latest
```

**何が起こっているか：**
```
あなたのパソコン:
Dockerイメージ（200MB）
    ↓ アップロード
Artifact Registry（GCP）:
保存完了
```

#### 確認

GCP ConsoleでArtifact Registryを開く：

```
https://console.cloud.google.com/artifacts/docker/[PROJECT_ID]/asia-northeast1/todo-api
```

`todo-api` イメージが表示されていればOK！

### 4.7 Cloud SQL（データベース）の準備

#### Cloud SQLインスタンスが既に存在する場合

既にCloud SQLインスタンスがある場合は、そのまま使えます。

```bash
# インスタンス一覧を確認
gcloud sql instances list
```

#### データベース接続URL

Cloud Runから接続するための`DATABASE_URL`は以下の形式です：

```
postgresql://ユーザー名:パスワード@/データベース名?host=/cloudsql/プロジェクトID:リージョン:インスタンス名
```

**例：**
```
postgresql://postgres:your-password@/tododb?host=/cloudsql/todo-app-xxxxx:asia-northeast1:todo-db
```

この値は後でGitHub Secretsに登録します。

### 4.8 Cloud Runにデプロイ

いよいよ、Cloud Runにデプロイします！

```bash
gcloud run deploy todo-api \
  --image asia-northeast1-docker.pkg.dev/$PROJECT_ID/todo-api/todo-api:latest \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgresql://..." \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0
```

**コマンドの意味：**

| オプション | 意味 |
|-----------|------|
| `--image` | 使用するDockerイメージ |
| `--region` | デプロイするリージョン（東京） |
| `--platform managed` | フルマネージド（自動管理） |
| `--allow-unauthenticated` | 認証なしでアクセス可能 |
| `--set-env-vars` | 環境変数を設定（DATABASE_URL） |
| `--port 8080` | アプリが起動するポート |
| `--memory 512Mi` | メモリ512MB割り当て |
| `--cpu 1` | CPU 1個割り当て |
| `--max-instances 10` | 最大10個まで自動スケール |
| `--min-instances 0` | アクセスがない時は0個（料金節約） |

#### デプロイ完了

数分後、以下のように表示されます：

```
Service [todo-api] revision [todo-api-00001-xxx] has been deployed
and is serving 100 percent of traffic.
Service URL: https://todo-api-xxxxx-an.a.run.app
```

### 4.9 動作確認

#### APIにアクセス

```bash
curl https://todo-api-xxxxx-an.a.run.app
```

レスポンスが返ってくればOK！

```json
{
  "message": "Hello from Hono!"
}
```

#### 特定のエンドポイントを確認

```bash
curl https://todo-api-xxxxx-an.a.run.app/api/todos
```

---

## 5. ステップ3：CI/CDで自動デプロイを設定する

### CI/CDとは

**CI/CD** = **Continuous Integration / Continuous Deployment**

簡単に言うと：

```
【あなたがやること】
1. コードを書く
2. git add .
3. git commit -m "機能追加"
4. git push origin main

↓ ここまで ↓

【GitHub Actionsが自動でやる】
5. コードをチェックアウト
6. Dockerイメージをビルド
7. Artifact Registryにプッシュ
8. Cloud Runにデプロイ

→ 数分後、本番環境に自動反映！
```

**メリット：**
- 手作業のミスがなくなる
- デプロイが早くなる
- いつでも最新のコードが本番環境で動く

### 5.1 GitHub Actionsとは

**GitHub Actions** は、GitHubが提供するCI/CDサービスです。

- GitHubリポジトリに`.github/workflows/`フォルダを作る
- YAMLファイルで「何をするか」を定義
- コードをpushすると自動実行される

### 5.2 GCPサービスアカウントの作成

GitHub ActionsからGCPにアクセスするには、**サービスアカウント**が必要です。

#### サービスアカウントとは

人間の代わりにアプリがGCPを操作するための「ロボットアカウント」です。

#### 作成手順

```bash
# 1. サービスアカウント作成
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD"

# 2. 必要な権限を付与
# Cloud Run管理者
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Artifact Registry書き込み
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# サービスアカウントユーザー
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 3. JSONキーを生成
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com

# 4. key.jsonの内容を表示（これをコピー）
cat key.json
```

**重要：**
- `key.json` の内容全体をコピーしてください
- GitHub Secretsに登録したら、**必ずこのファイルを削除**してください

```bash
# GitHub Secretsに登録後、削除
rm key.json
```

### 5.3 GitHub Secretsに登録

#### GitHub Secretsとは

APIキーやパスワードなど、**公開してはいけない情報**を安全に保存する場所です。

#### 登録手順

1. GitHubリポジトリを開く
2. **Settings** → **Secrets and variables** → **Actions**
3. 「New repository secret」をクリック
4. 以下を1つずつ登録:

##### バックエンド用

| Name | Value |
|------|-------|
| `GCP_PROJECT_ID` | `todo-app-xxxxx`（あなたのプロジェクトID） |
| `GCP_SERVICE_ACCOUNT_KEY` | `key.json`の内容全体 |
| `GCP_REGION` | `asia-northeast1` |
| `CLOUD_RUN_SERVICE_NAME` | `todo-api` |
| `DATABASE_URL` | `postgresql://...`（Cloud SQL接続URL） |

##### フロントエンド用

| Name | Value |
|------|-------|
| `VERCEL_TOKEN` | ステップ3.5で取得したトークン |
| `VERCEL_ORG_ID` | ステップ3.5で取得したOrganization ID |
| `VERCEL_PROJECT_ID` | ステップ3.5で取得したProject ID |

### 5.4 フロントエンドCI/CD設定

#### vercel.json を作成

プロジェクトルートに `vercel.json` を作成：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install"
}
```

#### GitHub Actionsワークフロー作成

`.github/workflows/frontend-deploy.yml` を作成：

```yaml
name: Deploy Frontend to Vercel

on:
  push:
    branches:
      - main
    paths:
      - "src/**"
      - "public/**"
      - "index.html"
      - "package.json"
      - "vite.config.ts"
      - "vercel.json"
      - ".github/workflows/frontend-deploy.yml"

jobs:
  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
          working-directory: ./
```

**この設定の意味：**

1. **on.push.paths**: これらのファイルが変更されたときだけ実行
2. **steps**:
   - コードをチェックアウト
   - Node.js 20をセットアップ
   - ライブラリをインストール
   - ビルド実行
   - Vercelにデプロイ

### 5.5 バックエンドCI/CD設定

`.github/workflows/backend-deploy.yml` を作成：

```yaml
name: Deploy Backend to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - "todo-api/**"
      - ".github/workflows/backend-deploy.yml"

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: ${{ secrets.GCP_REGION }}
  SERVICE_NAME: ${{ secrets.CLOUD_RUN_SERVICE_NAME }}
  REPOSITORY: todo-api
  IMAGE_NAME: todo-api

jobs:
  deploy:
    name: Build and Deploy to Cloud Run
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: "${{ secrets.GCP_SERVICE_ACCOUNT_KEY }}"

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: |
          gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build Docker image
        working-directory: ./todo-api
        run: |
          docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} .
          docker tag ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
                     ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:latest

      - name: Push Docker image to Artifact Registry
        run: |
          docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated \
            --set-env-vars "DATABASE_URL=${{ secrets.DATABASE_URL }}" \
            --port 8080 \
            --memory 512Mi \
            --cpu 1 \
            --max-instances 10 \
            --min-instances 0

      - name: Run database migrations
        working-directory: ./todo-api
        run: |
          npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**この設定の意味：**

1. **on.push.paths**: `todo-api/**` が変更されたときだけ実行
2. **env**: 環境変数を定義（PROJECT_IDなど）
3. **steps**:
   - コードをチェックアウト
   - GCPに認証
   - Cloud SDKをセットアップ
   - Docker認証設定
   - Dockerイメージをビルド（コミットSHA と latest の2つのタグ）
   - Artifact Registryにプッシュ
   - Cloud Runにデプロイ
   - データベースマイグレーション実行

### 5.6 テストデプロイ

設定ファイルをコミット&プッシュして、CI/CDをテストしましょう！

```bash
# 作業ブランチで作業中の場合
git add .
git commit -m "Add CI/CD workflows"
git push origin main
```

#### GitHub Actionsを確認

1. GitHubリポジトリを開く
2. **Actions** タブをクリック
3. 実行中のワークフローが表示される

**2つのワークフローが表示されるはず：**
- `Deploy Frontend to Vercel`
- `Deploy Backend to Cloud Run`

#### 成功を確認

各ワークフローをクリックして、すべてのステップに緑のチェックマークが付いていればOK！

---

## 6. 完了確認とテスト

### 6.1 フロントエンド確認

#### Vercelダッシュボード

1. [Vercel Dashboard](https://vercel.com/dashboard) を開く
2. プロジェクトを選択
3. 最新のデプロイが "Ready" になっているか確認

#### ブラウザでアクセス

```
https://your-app.vercel.app
```

- ページが表示される
- スタイルが正しく適用されている
- 基本機能が動作する

### 6.2 バックエンド確認

#### Cloud Runコンソール

1. [Google Cloud Console](https://console.cloud.google.com/run) を開く
2. `todo-api` サービスを確認
3. ステータスが "Ready" になっているか確認

#### APIテスト

```bash
# Cloud RunのURLを環境変数に設定
export API_URL="https://todo-api-xxxxx-an.a.run.app"

# ヘルスチェック
curl $API_URL

# TODOリスト取得
curl $API_URL/api/todos
```

### 6.3 フロントエンドとバックエンドの連携確認

#### フロントエンドの環境変数を設定

Vercelダッシュボードで、バックエンドAPIのURLを環境変数として設定：

1. Vercel Dashboard → プロジェクト → **Settings** → **Environment Variables**
2. 以下を追加:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://todo-api-xxxxx-an.a.run.app` |

3. 「Save」をクリック
4. 「Redeploy」をクリックして再デプロイ

#### エンドツーエンドテスト

1. フロントエンドURL（Vercel）を開く
2. TODOを新規作成
3. ページをリロード
4. TODOが保存されているか確認

**ブラウザの開発者ツールで確認：**

1. F12を押して開発者ツールを開く
2. **Network** タブを開く
3. TODOを作成
4. `POST https://todo-api-xxxxx-an.a.run.app/api/todos` が表示される
5. ステータスコード `200 OK` が返ってくる

### 6.4 自動デプロイのテスト

最後に、自動デプロイが本当に動くか確認しましょう。

#### フロントエンドを変更

```bash
# src/App.tsx を少し変更
# 例: タイトルを変更

git add src/App.tsx
git commit -m "test: Update app title"
git push origin main
```

#### GitHub Actionsを確認

1. GitHubリポジトリ → **Actions**
2. `Deploy Frontend to Vercel` が自動実行される
3. 数分後、Vercelにデプロイされる

#### ブラウザで確認

Vercel URLを開いて、変更が反映されているか確認。

#### バックエンドを変更

```bash
# todo-api/src/index.ts を少し変更
# 例: レスポンスメッセージを変更

git add todo-api/
git commit -m "test: Update API message"
git push origin main
```

#### GitHub Actionsを確認

1. GitHubリポジトリ → **Actions**
2. `Deploy Backend to Cloud Run` が自動実行される
3. 以下のステップが順番に実行される：
   - Dockerイメージビルド
   - Artifact Registryにプッシュ
   - Cloud Runにデプロイ

#### APIで確認

```bash
curl https://todo-api-xxxxx-an.a.run.app
```

変更が反映されていればOK！

---

## おめでとうございます！

これで、以下のすべてが完了しました：

1. **Reactフロントエンド**をVercelにデプロイ
2. **HonoバックエンドAPI**をCloud Runにコンテナでデプロイ
3. **CI/CD**で自動デプロイの仕組みを構築

### これから何が起こるか

今後は、コードを変更して `git push` するだけで：

```
あなた:
git push origin main

↓ 自動実行 ↓

GitHub Actions:
1. フロントエンド変更があれば → Vercelにデプロイ
2. バックエンド変更があれば → Cloud Runにデプロイ

↓ 数分後 ↓

本番環境:
最新のコードが自動反映！
```

**もう手動デプロイは不要です！**

---

## 次のステップ

### カスタムドメインを設定

#### Vercel（フロントエンド）

1. Vercel Dashboard → プロジェクト → **Settings** → **Domains**
2. カスタムドメインを追加（例: `todo.example.com`）
3. DNS設定を行う

#### Cloud Run（バックエンド）

```bash
gcloud run domain-mappings create \
  --service todo-api \
  --domain api.example.com \
  --region asia-northeast1
```

### モニタリング設定

#### Vercel Analytics

Vercel Dashboard → プロジェクト → **Analytics** で有効化

#### GCP Cloud Monitoring

1. [Google Cloud Console](https://console.cloud.google.com/monitoring) を開く
2. Cloud Run メトリクスを確認
3. アラートポリシーを設定

### セキュリティ強化

1. **CORS設定**:
   ```typescript
   // todo-api/src/index.ts
   app.use('*', cors({
     origin: ['https://your-app.vercel.app'],
     credentials: true,
   }))
   ```

2. **環境変数をSecret Managerに移行**:
   ```bash
   # Secret Manager にシークレット作成
   gcloud secrets create database-url \
     --data-file=- <<< "postgresql://..."

   # Cloud Run で使用
   gcloud run deploy todo-api \
     --set-secrets="DATABASE_URL=database-url:latest"
   ```

3. **認証を追加**:
   - Firebase Authentication
   - Auth0
   - Clerk など

---

## トラブルシューティング

### Q: GitHub Actionsが失敗する

#### フロントエンド

**エラー: `VERCEL_TOKEN is not set`**

→ GitHub Secretsに `VERCEL_TOKEN` が登録されているか確認

**エラー: `Build failed`**

→ ローカルで `npm run build` が成功するか確認

#### バックエンド

**エラー: `Permission denied`**

→ サービスアカウントに必要な権限が付与されているか確認

```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@*"
```

**エラー: `Database connection failed`**

→ `DATABASE_URL` が正しいか確認

### Q: Cloud Runにデプロイしたが、アプリが起動しない

#### ログを確認

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=todo-api" \
  --limit 50 \
  --format=json
```

#### よくある原因

1. **ポート番号が違う**: Cloud Runは `PORT` 環境変数を使う
   ```typescript
   // todo-api/src/index.ts
   const port = process.env.PORT || 8080
   ```

2. **DATABASE_URLが設定されていない**:
   ```bash
   gcloud run services update todo-api \
     --set-env-vars "DATABASE_URL=postgresql://..." \
     --region asia-northeast1
   ```

3. **Prisma Clientが生成されていない**:
   ```dockerfile
   # Dockerfile
   RUN npx prisma generate
   ```

### Q: フロントエンドからバックエンドAPIに接続できない

#### CORS設定を確認

```typescript
// todo-api/src/index.ts
import { cors } from 'hono/cors'

app.use('*', cors({
  origin: [
    'http://localhost:5173', // 開発環境
    'https://your-app.vercel.app' // 本番環境
  ],
  credentials: true,
}))
```

#### 環境変数を確認

Vercelに `VITE_API_URL` が設定されているか確認。

---

## 用語集

| 用語 | 意味 |
|------|------|
| **コンテナ** | アプリとその動作環境をまとめたパッケージ |
| **Docker** | コンテナを作るツール |
| **docker-compose** | 複数のコンテナをまとめて管理するツール（開発用） |
| **Dockerfile** | コンテナの設計図 |
| **イメージ** | Dockerfileから作成されたテンプレート |
| **Artifact Registry** | Dockerイメージを保存するGCPのサービス |
| **Cloud Run** | コンテナを動かすGCPのサービス |
| **Cloud SQL** | データベースを動かすGCPのサービス |
| **CI/CD** | コードを自動的にテスト・デプロイする仕組み |
| **GitHub Actions** | GitHubが提供するCI/CDサービス |
| **Vercel** | フロントエンドを簡単にデプロイできるサービス |
| **サービスアカウント** | アプリがGCPを操作するための認証情報 |
| **GitHub Secrets** | APIキーなどの機密情報を安全に保存する場所 |

---

## まとめ

このガイドでは、コンテナの基礎から実際のデプロイ、CI/CD自動化まで学びました。

**あなたが習得したこと：**

1. コンテナの概念と使い方
2. 開発環境と本番環境の違い
3. Reactアプリの本番デプロイ（Vercel）
4. Node.jsバックエンドのコンテナデプロイ（Cloud Run）
5. CI/CDで自動デプロイの仕組みを構築

これで、プロダクションレベルのデプロイフローが完成しました！

今後は、コードを書いて `git push` するだけで、自動的に本番環境に反映されます。

Happy coding!
