<?php
$lines = file('storage/logs/laravel.log');
foreach(array_reverse($lines) as $line) {
    if(strpos($line, 'local.ERROR') !== false) {
        echo $line;
        break;
    }
}
