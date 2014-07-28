<?php
	session_start();
	$pv = $_POST["data"];
	if($pv == "belepek")
		$_SESSION["logged"] = 1;
	else
		unset($_SESSION["logged"]);

	if(isset($_SESSION["logged"]))
		echo "benn vagy";
	else
		echo "nem jó...";
?>