# Write & Read Windows .LNK files in pure JS

Implemented following the [\[MS-SHLLINK\] Shell Link (.LNK) Binary File Format Documentation](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-shllink/16cb4ca1-9339-4d0c-a68d-bf1d6cc0f943).

While the documentation above is a good starting point, it is missing essential information about the LinkTargetIDList-ItemID structure.
This information was obtained by:

- Reverse engineering existing files and padding `0`s instead of real values
- Finding some guesses in a [Java Implementation by Dmitrii Shamrikov](https://github.com/DmitriiShamrikov/mslinks/blob/master/src/mslinks/data/ItemID.java)
- Finding some guesses in [mslink by Mikaël Le Bohec](http://www.mamachine.org/mslink/index.en.html)

Feel free to improve this library, but please make sure to read all sources above before.


## Installation:

`npm install winlink`

## Usage:

```javascript
const shellLink = require("winlink");

/* create file-link: writeFile( filename, target ) */
writeFile( "a.lnk", "C:\\temp\\a.txt" );

/* create directory-link: writeDirectory( filename, target ) */
writeDirectory( "test.lnk", "C:\\temp" );
```

## Motivation for pure JavaScript:
My intention is to write `.lnk`-files on samba-mounts under linux without using wine or other helpers.
