import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "react-intl";
import { ThemeProvider, createTheme } from "smarthr-ui";
// smarthr-ui のスタイル。自分たちの index.css より先に読み、
// 競合したときは Tailwind のユーティリティ側が勝つようにする
import "smarthr-ui/smarthr-ui.css";
import "./index.css";
import { App } from "./App.tsx";

// smarthr-ui は ThemeProvider と IntlProvider の2枚を要求する（README）。
// createTheme() は既定のデザイントークンを返す。色を変えるのはまだ先で、
// ここでは既定のまま入れて、見た目が変わらないことを確認する（Phase 8-2）
const theme = createTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IntlProvider locale="ja">
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </IntlProvider>
  </StrictMode>,
);
