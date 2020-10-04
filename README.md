＃Datenanfragen.deのバックエンド

> Datenanfragen.deはほとんど静的サイトとして実行されますが、一部の機能にはサーバーが必要です。 これらのエンドポイントはここで定義されます。

TODO：これはまだ非常に進行中の作業です。 コードもこのREADMEもまだ完了していません。

＃＃ セットアップ

*リポジトリのクローンを作成します。
*必要な依存関係を取得します： `yarn`
* `config-sample.json`を` config.json`にコピーし、それに応じて設定を変更します。
*データベースを初期化します： `yarn knexmigrate：latest`
### Development

`yarndev`を使用して開発サーバーを起動できます。 何かを変更すると自動的にリロードされます。 支払いプロバイダーのテストは、それぞれのテストAPIを使用して実行できます。

* ** mollie **：提供されたテストAPIキーと、 `config-sample.json`で構成されたエンドポイントを使用します
* ** CoinGate **：[sandbox.coingate.com]（https://sandbox.coingate.com）でアカウントを作成し（「ビジネス」または「マーチャント」アカウントが必要です）、次のAPIエンドポイントを使用します サンドボックス（ `https：// api-sandbox.coingate.com / v2 / orders`）とサンドボックスAPIキーの組み合わせ。
