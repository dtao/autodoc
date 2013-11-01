This folder contains an example "JavaScript library" (one that no one would ever actually write) called **redundant.js** to demonstrate what Breakneck is capable of.

Try running this command in this directory:

    breakneck -t redundant.js

You should see some tests run. If you add the `--verbose` option you'll see them in Jasmine's nested format.

Now run *this* command:

    breakneck redundant.js

Now open up **docs/index.html** in your browser and marvel at the sweet API docs that just got generated!
