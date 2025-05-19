# YCS-Continued

Original YCS (YouTube Comment Search) extension repository: <https://github.com/sonigy/YCS>

According to [this issue](<https://github.com/sonigy/YCS/issues/56>), the original YCS extension's feature to load comments stopped working on March 28, 2024.

Since the original YCS extension wasn't open-sourced and the YCS author hadn't provided a resolution, in June 2024 I created this YCS-Continued extension as a temporary fix.

YouTube significantly changed their API for rendering the comments section on March 28, 2024. This led to the failure of extensions that relied on unofficial APIs to fetch comments.

This version tries to migrate the latest API data back to the old version, allowing the YCS extension to work as expected. However, it's unclear whether there will be updates to this version of the extension if YouTube decides to change their API usage again.


## Install From Stores

- Chrome Web Store: https://chromewebstore.google.com/detail/ycs-youtube-comment-searc/mfobjniokjbcldieppimekoibpocahed
- Firefox Add-ons: https://addons.mozilla.org/firefox/addon/ycs-continued/

## Manual Install

### With .crx (Vivaldi, Opera etc)

- Download the .crx file from the [release page](https://github.com/pc035860/YCS-cont/releases).
- Open the .crx file with your Chromium-based browser (Chrome, Edge, Brave, Vivaldi etc).
  
### With .xpi (Firefox)

- Download the .xpi file from the [release page](https://github.com/pc035860/YCS-cont/releases).
- Open the .xpi file with Firefox.
- To enable automatic loading on YouTube, right-click on the extension icon and choose `Always Allow on www.youtube.com`.
  - <img src="https://github.com/pc035860/YCS-cont/assets/811518/bc8d1009-81bb-4064-8198-d4d62ab78f53" width="420">


### Download zip

- Download the zip file from the [release page](https://github.com/pc035860/YCS-cont/releases) and unzip it.
- Navigate to the chrome://extensions/ page and enable developer mode.
- Click "Load unpacked" and select the unzipped folder.

### Use git

- Clone this repository.
- Navigate to the chrome://extensions/ page and enable developer mode.
- Click "Load unpacked" and select the repository folder.

