/*
 * 三明治易起走｜小衍回填設定（由管理者填寫，不含任何密碼或憑證）
 * 這兩個網址本來就會公開給觀眾，放在 GitHub 上沒有安全問題。
 * 試算表的寫入權限只存在 Google Apps Script 裡，不在這裡。
 */
window.XY_CONFIG = {
  // 環境標示：'test' 會在頁面上顯示「測試環境」字樣
  env: 'test',

  // 【管理者設定 1】Google 表單預填連結（見 docs/SETUP.md 步驟 A3）
  // 把「登記識別碼」那格預填成 __RID__ 後複製整條網址貼在這裡。
  // 例：'https://docs.google.com/forms/d/e/XXXX/viewform?usp=pp_url&entry.123456789=__RID__'
  formPrefillTemplate: 'https://docs.google.com/forms/d/e/1FAIpQLSf9uoxJyE-exLp_pIEubFraw8egtPorihxFXOkXpBNNDGhcFA/viewform?usp=pp_url&entry.433084600=__RID__',

  // 【管理者設定 2】Apps Script 網頁應用程式網址（見 docs/SETUP.md 步驟 B6）
  // 例：'https://script.google.com/macros/s/XXXX/exec'
 submitEndpoint: 'https://script.google.com/macros/s/AKfycbzAAoB1TdbzOiBRoU4AUtMAYZ5zAYH120PBOJHSokyQbawKncG6SkDreKkACBbX1tspVw/exec',
};
