<?php
	session_start();
	if(!isset($_SESSION["logged"])) {
		die("Error: not logged");
	}

	$filename = "../dw.json";

	$fh = fopen($filename, 'w') or die("Error: can't open file" . $filename);
	$stringData = $_POST["data"];
	fwrite($fh, pack("CCC",0xef,0xbb,0xbf)); 
	fwrite($fh, stripslashes($stringData));
	fclose($fh) or die("Error: can't close file:" . $filename);
	echo('success');
?>
