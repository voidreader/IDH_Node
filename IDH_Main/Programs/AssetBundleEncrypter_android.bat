forfiles /p E:\Git\IDH\AssetBundles\Android /s /m *.bin /c "cmd /c del @file"
forfiles /p E:\Git\IDH\AssetBundles\Android /s /m *.manifest /c "cmd /c del @file"

forfiles /P E:\Git\IDH\AssetBundles\Android /s /M * /C "cmd /c if @isdir==FALSE openssl rc2 -nosalt -p -in @fname -out @fname.bin -k imageframe.game"

forfiles /P E:\Git\IDH\AssetBundles\Android /s /M *.bin /C "cmd /c echo @fname @fsize"

pause>nul