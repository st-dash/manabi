# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

子ども向け教育アプリを開発するフォルダ。対象学年は**小学1年生**と**小学5年生**の2パターンがある。

## フォルダ構成

**アプリごとに専用サブフォルダを作り、ファイルが混ざらないようにする。** 新しいアプリを追加するときは、必ず新規サブフォルダ（例: `new-app/`）を作成し、その中に HTML/CSS/JS 一式を収める。ルート直下に個別アプリのファイルを直接置かない。

## 既存アプリ

### RSTクエスト（rst-quest/rst-quest.html）
リーディングスキルテスト（RST）を活用した読解力向上アプリ。RPGバトル形式で6つの読解スキルを練習する。対象は小学5年生。
構成: `rst-quest.html` / `style.css` / `game.js` / `data.js`

### まなびランク（progress-tracker/index.html）
教科ごとの習得度を、フォートナイト風のランク（ブロンズ〜マスター、全16段階）でざっくり可視化する進捗トラッカー。対象学年は問わず（小1〜大学レベルまで想定）、人ごと・教科ごとに手動でランクを設定して一覧・詳細表示する。データはブラウザの localStorage に保存（サーバー不要）。
構成: `index.html` / `style.css` / `app.js`
