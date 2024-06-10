# YCS-Continued

Original extension repository: <https://github.com/sonigy/YCS>

According to [this issue](<https://github.com/sonigy/YCS/issues/56>), the extension's feature to load comments stopped working on March 28.

Since the original extension isn't open-sourced and the author hasn't provided a resolution (as of June 1), I've created a temporary fix here.

YouTube significantly changed their API for rendering the comments section on March 28. This led to the failure of extensions that relied on unofficial APIs to fetch comments.

This version tries to migrate the latest API data back to the old version, allowing the YCS extension to work as expected. However, it's unclear whether there will be updates to this version of the extension if YouTube decides to change their API usage again.


## Install

### With .crx

- Download the .crx file from the [release page](https://github.com/pc035860/YCS-cont/releases).
- Open the .crx file with Chrome.

### Download zip

- Download the zip file from the [release page](https://github.com/pc035860/YCS-cont/releases) and unzip it.
- Navigate to the chrome://extensions/ page and enable developer mode.
- Click "Load unpacked" and select the unzipped folder.

### Use git

- Clone this repository.
- Navigate to the chrome://extensions/ page and enable developer mode.
- Click "Load unpacked" and select the repository folder.

### With .xpi (Firefox)

- Download the .xpi file from the [release page](https://github.com/pc035860/YCS-cont/releases).
- Open the .xpi file with Firefox.
