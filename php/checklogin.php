<?php
	session_start();
	if(!isset($_SESSION["logged"])) {
		die("0");
	}
	die("1");
?>