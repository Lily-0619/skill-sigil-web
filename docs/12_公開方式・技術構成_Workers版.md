# スキル秘伝HP 公開方式・技術構成

## 1. 目的

スキル秘伝HPを、一般ユーザーがURLから利用できるWebアプリとして公開するための方式と、WordPressを使用するかどうかの判断を記録する。

この資料は公開先・技術構成の方針を示すものであり、まなが明示的に「実装開始」と言うまでは、コード作成・GitHubリポジトリ作成・Cloudflare設定・ドメイン取得は行わない。

## 2. 結論

本サイトは、WordPressサイトではなく、**サーバー側のユーザー処理やデータベースを持たない静的Webアプリ**として制作する。

公開には、Cloudflareが新規プロジェクト向けに推奨している **Cloudflare Workers Static Assets** を使用する。

推奨構成は次のとおり。

| 区分 | 採用方針 |
| :---- | :---- |
| アプリ形式 | 静的Webアプリ／SPA |
| フロントエンド | React + TypeScript + Viteを第一候補 |
| ユーザーデータ保存 | 利用者のブラウザ内のIndexedDB |
| バックアップ | Excel書き出し・読み込み |
| ソース管理 | GitHub |
| 公開先 | Cloudflare Workers Static Assets |
| 自動ビルド・公開 | Workers BuildsとGitHubを連携 |
| 公開設定・デプロイ管理 | Wrangler設定ファイルを使用 |
| 代替公開先 | GitHub Pages |
| Cloudflare Pages | 新規採用しない |
| ログイン | MVPでは不要 |
| サーバーデータベース | MVPでは使用しない |
| WorkerのAPI処理 | MVPでは使用しない |
| 独自ドメイン | MVP完成後または正式公開時に検討 |
| WordPress | MVPでは使用しない |

## 3. このサイトの分類

スキル秘伝HPは、文章を読むことが中心の一般的なホームページやブログではなく、ユーザーが操作して結果を保存する**ブラウザアプリ**である。

主な操作:

- 所持秘伝の登録・編集・削除
- クラスとスキルの選択
- 固定枠への秘伝装着
- 装着可否と所持残数の判定
- 複数編成の保存・複製
- 利用端末内への自動保存
- Excelバックアップの書き出し・読み込み

静的Webアプリという名称でも、画面が動かないわけではない。

アプリ本体・画像・共通マスタデータをCloudflare Workersから配信し、画面操作、計算、判定、利用者データの保存は各利用者のブラウザ内で行う。

このため、MVPでは会員情報や所持データを保存する専用バックエンドやサーバーデータベースを持たない。

## 4. WordPressを採用しない理由

WordPressでも、独自プラグインやJavaScriptを追加すれば同様の機能を組み込むことは技術的に可能である。

ただし、今回必要な次の処理は、WordPressを使用しても専用開発が必要になる。

- IndexedDBへの保存
- 所持数・使用数・残数の計算
- 秘伝タイプと固定枠の互換判定
- 複数編成の管理
- Excel入出力
- クラス・スキル画像の切り替え
- 画面状態の管理

WordPressへ組み込む場合は、アプリ本体に加えて次の管理も増える。

- WordPress本体の更新
- テーマの更新と互換性確認
- プラグインの更新と競合確認
- PHP・データベースを含むサーバー管理
- WordPressへアプリを組み込む追加作業

そのため、MVPではWordPressを採用せず、必要な機能だけを持つWebアプリとして直接制作するほうが、構造が単純で保守しやすい。

## 5. 推奨技術構成

### 5.1 フロントエンド

第一候補:

- React: 画面・部品・状態の管理
- TypeScript: 装着判定やデータ構造の誤りを減らす
- Vite: 開発環境と公開用ファイルの生成

Reactは必須条件ではないが、画面数、保存データ、装着状態、検索条件などが増える本サイトでは、HTML・CSS・JavaScriptだけで管理するより保守しやすいと判断する。

### 5.2 データ

```text
ゲーム共通データ
├─ クラスマスタ
├─ スキルマスタ
├─ 固定秘伝枠
├─ 秘伝タイプ
├─ 効果マスタ
└─ 画像マニフェスト

利用者データ
├─ 所持秘伝
├─ 保存編成
├─ 装着状況
├─ 設定
└─ バックアップ履歴
```

- ゲーム共通データは、JSONなどのアプリ用データへ変換して公開する。
- 利用者データはIndexedDBへ保存する。
- 利用者データをCloudflare側のデータベースへ保存しない。
- 別PC・別ブラウザ・機種変更時の移行はExcelバックアップを利用する。

### 5.3 公開基盤

採用するCloudflare機能:

- Workers Static Assets: HTML、CSS、JavaScript、JSON、画像などの配信
- Workers Builds: GitHubへの変更反映を契機とした自動ビルド・自動公開
- Wrangler: Worker名、公開対象フォルダ、SPA設定などの構成管理
- `workers.dev`: 試験公開用の初期URL
- Custom Domains: 正式公開時に独自ドメインを接続する場合に使用

### 5.4 MVPではWorkerスクリプトを持たない

Cloudflare Workersを利用しても、MVPでサーバー側プログラムを書く必要はない。

Workers Static Assetsは、Workerスクリプトを置かず、Viteが生成した静的ファイルだけを公開する構成に対応している。

概念上の設定例:

```jsonc
{
  "name": "skill-sigil-web",
  "compatibility_date": "実装開始時の日付",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- `directory`にはViteのビルド出力先を指定する。
- SPA設定により、アプリ内のURLへ直接アクセスした場合の404を防ぐ。
- 正式なWorker名・設定値は実装計画時に確定する。

### 5.5 将来の拡張

MVP完成後、必要性が明確になった場合だけ、Workersのサーバー機能を追加する。

候補:

- Worker API
- Cloudflare D1によるデータベース
- KVによる設定・キャッシュ保存
- R2によるファイル保存
- ログイン・認証
- クラウド同期
- 編成共有
- 管理画面

Workersを公開先に採用することと、最初からこれらの機能を導入することは別である。

MVPでは静的ファイル配信とブラウザ内保存だけを使用する。

## 6. 公開構成

```text
まながGitHubへ変更を反映
        ↓
Workers Buildsが自動ビルド
        ↓
Workers Static Assetsへ自動公開
        ↓
利用者がURLからアクセス
        ↓
画面処理・計算は利用者のブラウザ内で実行
        ↓
所持秘伝・編成は利用者のIndexedDBへ保存
```

### 6.1 Cloudflare Workers Static Assetsを採用する理由

- Cloudflareが新規の静的サイト、SPA、フルスタックアプリに推奨している
- React + Viteのビルド結果を静的アセットとして公開できる
- Workerスクリプトなしでも利用できる
- GitHubと接続して自動ビルド・自動公開できる
- プルリクエスト単位のビルド状況やプレビューを確認できる
- 初期は`workers.dev`のURLで試験公開できる
- 後から独自ドメインを設定できる
- 将来APIやデータベースが必要になった場合も同じ基盤上で拡張できる

### 6.2 Workersを使っても利用者データはサーバー保存しない

Cloudflare Workersは、アプリをインターネットへ配信するための公開基盤として使用する。

```text
Cloudflare Workers側
├─ HTML
├─ CSS
├─ JavaScript
├─ クラス画像
├─ スキル画像
└─ ゲーム共通JSON

利用者のブラウザ側
├─ 所持秘伝
├─ 保存編成
├─ 装着状況
├─ 設定
└─ バックアップ履歴
```

AさんとBさんが同じURLへアクセスしても、各自の保存内容は別々のブラウザ内に保存される。

まなのCloudflareアカウントへ、利用者の所持秘伝や編成が自動的に送信される構成にはしない。

### 6.3 公開URL

試験公開時は、Cloudflare Workersが発行する`workers.dev` URLを利用できる。

想定例:

```text
https://skill-sigil-web.<account-subdomain>.workers.dev
```

正式公開時は、必要に応じて独自ドメインまたはサブドメインを設定する。

想定例:

```text
https://skill.example.jp
```

実際のWorker名、アカウントサブドメイン、正式URLは実装・公開時に決める。

### 6.4 費用の基本方針

Workers Static Assetsで静的ファイルへ直接応答するリクエストは無料かつ無制限で、静的アセットの保存にも追加料金は発生しないとCloudflare公式資料に記載されている。

ただし、将来Workerスクリプト、D1、KV、R2などを使用する場合は、それぞれの無料枠・制限・料金を導入時に確認する。

MVPでは、静的アセット配信だけで運用できる構成を優先する。

### 6.5 Cloudflare Pagesの扱い

Cloudflare Pagesは現在も利用できるが、本プロジェクトでは新規採用しない。

Cloudflare公式は、新しい静的サイト、SPA、フルスタックアプリについてWorkers Static Assetsを推奨し、新機能と最適化をWorkers側へ集中させる方針を示している。

本プロジェクトはまだ実装前であり、既存のPages環境から移行する必要もないため、最初からWorkers Static Assetsを使用する。

### 6.6 Workers Sitesは使用しない

名称が似ているが、採用するのは**Workers Static Assets**である。

旧方式の**Workers Sites**は使用しない。

実装指示書、README、設定ファイルでは、両者を混同しないよう正式名称を記載する。

## 7. GitHubでの管理イメージ

リポジトリ名の仮例:

```text
skill-sigil-web
```

フォルダ構成の仮例:

```text
skill-sigil-web/
├─ docs/              企画書・要件・設計資料
├─ public/            公開画像・マスタデータ
├─ src/               アプリ本体
├─ scripts/           マスタ変換・画像一覧生成
├─ tests/             テスト
├─ package.json       開発・ビルド用設定
├─ vite.config.ts     Vite設定
├─ wrangler.jsonc     Workers公開設定
└─ README.md
```

公開の基本フロー:

```text
作業ブランチで変更
        ↓
ローカルで動作確認・テスト
        ↓
Pull Requestを作成
        ↓
プレビュー環境で確認
        ↓
公開対象ブランチへ反映
        ↓
Workers Buildsが本番公開
```

公開対象ブランチ、Pull Request運用、自動テストの範囲は実装計画時に確定する。

## 8. 公開までの段階

### 段階1: ローカル開発

- まなのPC上で動作確認する。
- 所持秘伝・装着・保存・Excel復元をテストする。
- 公開用画像の容量と対応関係を確認する。
- Viteのビルド結果を確認する。
- Wrangler設定をローカルで検証する。

### 段階2: 限定的な試験公開

- Workersの`workers.dev`仮URLで公開する。
- URLを知っているテスターに確認してもらう。
- 必要に応じてCloudflare Accessなどによる閲覧制限を検討する。
- 正式名称や独自ドメインが未確定でも実施できる。

URLを知っている人だけに共有する方法は、厳密な非公開ではない。URLが転送・拡散されれば、ほかの人もアクセスできる可能性がある。

### 段階3: 正式公開

- 高重大度の問題が0件であることを確認する。
- 非公式ファンサイト表記を確認する。
- 最新のファンコンテンツガイドを確認する。
- 必要なら独自ドメインを設定する。
- 検索エンジンへの公開方針を決める。
- 公開後のマスタ更新手順を確定する。

## 9. ブログを追加したくなった場合

MVPではブログを持たない。

将来、攻略記事、更新履歴、使い方記事などを頻繁に投稿する場合は、次のどちらかを検討する。

### 案A: Webアプリ内へ記事ページを追加

```text
example.jp/
├─ アプリ
├─ 使い方
├─ 更新履歴
└─ お知らせ
```

記事数が少なく、更新頻度も低い場合に向く。

### 案B: WordPressブログを別に追加

```text
www.example.jp      WordPressブログ・攻略記事
skill.example.jp    スキル秘伝Webアプリ／Cloudflare Workers
```

記事を頻繁に投稿し、カテゴリ・検索・記事管理が必要になった場合に向く。

WordPressを導入する場合でも、スキル秘伝アプリ本体はWordPressから分離したまま運用する。

## 10. MVPで持たないサーバー機能

- 会員登録
- ログイン
- クラウド同期
- ゲームアカウント連携
- 利用者データのサーバー保存
- 共有編成データベース
- 管理画面からのリアルタイムマスタ更新
- Worker API
- D1
- KV
- R2
- Durable Objects
- Workers AI
- 広告・課金

これらが必要になった場合は、静的Webアプリだけではなく、バックエンド、認証、データベース、利用規約、プライバシーポリシー、料金、運用体制を含めて再設計する。

## 11. セキュリティ・プライバシー方針

- ゲームID、パスワード、メールアドレスを入力させない。
- 所持秘伝・編成・メモを外部サーバーへ送信しない。
- ブラウザデータを削除すると保存内容が消える可能性を明示する。
- シークレットモード、別ブラウザ、別端末では保存データが共有されないことを明示する。
- Excelバックアップを定期的に案内する。
- 外部解析ツールを導入する場合は、送信内容とプライバシー表記を別途確認する。
- GitHubとCloudflareの連携権限は、対象リポジトリだけに限定する。
- Cloudflare用の秘密情報やAPIトークンをGitHubへ直接保存しない。

## 12. 現時点の決定事項と残事項

### 決定

- WordPressはMVPで使用しない。
- 静的Webアプリ／SPAとして制作する。
- フロントエンドはReact + TypeScript + Viteを第一候補とする。
- GitHubでソースと資料を管理する。
- 公開先はCloudflare Workers Static Assetsとする。
- GitHub連携にはWorkers Buildsを使用する。
- Workersの構成管理にはWrangler設定ファイルを使用する。
- Cloudflare Pagesは新規採用しない。
- Workers Sitesは使用しない。
- 利用者データはブラウザ内のIndexedDBへ保存する。
- MVPではWorkerスクリプト、API、サーバーデータベースを使用しない。
- 正式なブログが必要になった場合だけWordPressを別に追加する。

### 未決

- サイトの正式名称
- GitHubリポジトリ名
- Worker名
- `workers.dev`のアカウントサブドメイン
- 正式公開URL
- 独自ドメインを取得するか
- 公開用ブランチと自動公開ルール
- Pull Requestとプレビュー公開の運用
- Wranglerの正式設定
- Cloudflare Viteプラグインを使用するか
- マスタ更新担当と公開手順
- 試験公開時にCloudflare Accessを使用するか

## 13. 実装停止ライン

この資料で公開方式の方向性は決定したが、実装・GitHubリポジトリ作成・Cloudflare設定・Workers作成・ドメイン取得は開始しない。

まなが明示的に「実装開始」と指示した後、次の順に進める。

```text
実装計画
  ↓
担当分け
  ↓
リポジトリ構成確定
  ↓
React + TypeScript + Vite環境作成
  ↓
Wrangler設定
  ↓
Workers BuildsとGitHubの連携
  ↓
試験公開
```

## 14. 公式参考資料

- [Cloudflare Workers Best Practices - Use Workers Static Assets for new projects](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-workers-static-assets-for-new-projects)
- [Cloudflare Workers - Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers - Single Page Application](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Cloudflare Workers - Billing and Limitations for Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare Workers - GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [Cloudflare Workers - workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare Workers - Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare Workers - Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Cloudflare Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [GitHub Pages - Custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [WordPress Plugin Handbook](https://developer.wordpress.org/plugins/)
