'use strict';

window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;

if (!window.AudioContext) {

    showOldBrowserWarning();
}

var DW, actx = new AudioContext(), aSource, aTrack, tracks = [], analyser, micStream, mode = 'play',
    PI = Math.PI, PI2 = PI*2, PIp2 = PI / 2, contentW = 712,
    lastRender = +new Date, cPreview, ctxPreview, cStage, ctxStage, phpRoot = 'php/',
    aWord, isSettingsOpen, gainOut, aSettings, isRecording = false,
    options = {
        title: 'title',
        artist: 'artist',
        renderScale: 1,
        globalRenderScale: 1,
        renderX: 0,
        renderY: 321,
        set gainOut(v) {gainOut.gain.value = v},
        get gainOut() {return gainOut.gain.value},
        set smoothingTimeConstant(v) {analyser.smoothingTimeConstant = v},
        get smoothingTimeConstant() {return analyser.smoothingTimeConstant},
        set minDecibels(v) {analyser.minDecibels = v},
        get minDecibels() {return analyser.minDecibels},
        set maxDecibels(v) {analyser.maxDecibels = v},
        get maxDecibels() {return analyser.maxDecibels}
    },
    playlist = [
        'slop',
        'cantaloupe',
        'valentine',
        'medeski',
        'loro',
        'reza',
        'moanin',
        'graffiti',
        'power',
        'take five'
    ], playlistIdx = 0, timeStartTrack, currLoadingTrack, tlPlayTitle, isSeeking;

$(document).ready(function () {

    $.getJSON('dw.json', function (_dw) {

        DW = _dw;

        init();
    });
});

function resetAnalyser() {

    if (gainOut) {

        gainOut.disconnect();
    }
    gainOut = actx.createGain();
    gainOut.gain.value = 1;
    gainOut.connect(actx.destination);

    if (analyser) {
        analyser.disconnect();
    }

    analyser = actx.createAnalyser();
    analyser.connect(gainOut);
    analyser.smoothingTimeConstant = options.smoothingTimeConstant;
    analyser.minDecibels = options.minDecibels;
    analyser.maxDecibels = options.maxDecibels;
}

function init() {

    makeRange('title', options.title, 'title', 1111, .01, function (v) {options.title = v}, 'text');
    makeRange('artist', options.artist, 'artist', 1111, .01, function (v) {options.artist = v}, 'text');

    makeRange('renderScale', options.renderScale, 0, 1111, .01, function (v) {options.renderScale = v});
    makeRange('globalRenderScale', options.globalRenderScale, 0, 1111, .01, function (v) {options.globalRenderScale = v});
    makeRange('renderX', options.renderX, 0, 1111, .01, function (v) {options.renderX = v});
    makeRange('renderY', options.renderY, 0, 1111, .01, function (v) {options.renderY = v});

    resetAnalyser();
    makeRange('gainOut', options.gain, 0, 1, .01, function (v) {options.gain = v})

    makeRange('smoothingTimeConstant', options.smoothingTimeConstant, 0, 1, .01, function (v) {options.smoothingTimeConstant = v})
    makeRange('minDecibels', options.minDecibels, +3000, 4000, 1, function (v) {options.minDecibels = v});
    makeRange('maxDecibels', options.maxDecibels, -3000, 4000, 1, function (v) {options.maxDecibels = v});

    cPreview = $('#canvas-preview').get(0);
    ctxPreview = cPreview.getContext('2d');





    cStage = $('#canvas-stage').get(0);
    ctxStage = cStage.getContext('2d');
    $('input#render-size-x')
        .val(cStage.width)
        .change(function () {
            cStage.width = this.value;
            cStage.style.left = ((contentW - cStage.width) / 2)  + 'px'
        });

    $('input#render-size-y')
        .val(cStage.height)
        .change(function () {cStage.height = this.value});

    $('input#render-show-border')
        .change(function () {cStage.style.border = this.checked ? 'solid' : 'none'});




    DW.wordList.forEach(function (word) {

        var $li = makeLi(word.id)
            .click(selectWord.bind(null, word));
        $('#select-word ul').append($li)
    });
    $('#select-word ul').children().first().click();

    $.getJSON('assets/tracks.json', function (fontList) {

        fontList.forEach(function (url) {
            addTrack({
                url: url,
                name: url.split('/').pop()
            });
        });

        next();
    });

    function next() {

        $('#upload').change(function () {

            var fileList = this.files;
        });

        var dropbox = document.body;
        dropbox.addEventListener("dragenter", dragenter, false);
        dropbox.addEventListener("dragover", dragover, false);
        dropbox.addEventListener("drop", drop, false);

        $('#track-btn-play').click(function () {
            if (aTrack) {
                playTrack(aTrack);
            }
        });

        $('#track-btn-stop').click(playStop);

        $('#modal-settings').on('hidde.bs.modal', function (e) {
            isSettingsOpen = false;
        });

        $('#modal-settings').on('show.bs.modal', function (e) {
            isSettingsOpen = true;
        });

        $('#btn-mic').click(micMode);

        $('#btn-mic-stop').click(micStop);










        $('#modal-login #btn-ok').click(function () {

            var url = phpRoot + 'int.php',
                pwd = $('#modal-login #input-pwd').val();

            $.post( url, { data: pwd }, function (res) {
                alert(res);
                saveDw();
            });
            $('#modal-login').modal('hide');
        });

        $('#settings-list #delete').click(function () {
            deleteSettings();
        });

        $('#save-settings #btn-ok').click(function () {

            saveSettings($('#save-settings #input-id').val());
        });

        //nemmmegy nemtomme;
        // $('#save-setting .modal-content').on('show.bs.modal', function () {

        //     $('#save-settings #input-id').val(aSettings ? aSettings.id : 'valami00')
        // })


        readDw();


        window.onhashchange = function () {

            var name = location.hash;

            if (name.indexOf('#') === 0) {

                name = name.substr(1);
            }

            var settings = getSettings(name);

            if (settings) {

                if (playlist.indexOf(name) !== -1) {

                    playlistIdx = playlist.indexOf(name);
                }

                useSettings(settings);
            }
            else {
                useSettings(playlist[0]);
            }
        }

        window.onhashchange();

        window.requestAnimationFrame(render);
    }

    $('.control').mouseenter(function () {
        TweenMax.to($(this).find('.highlight'), .34, {opacity: 1, ease: Sine.easeOut});
    });
    $('.control').mouseleave(function () {
        TweenMax.to($(this).find('.highlight'), .34, {opacity: 0, ease: Sine.easeOut});
    });

    $('#play').click(function () {useSettings(playlist[playlistIdx])});
    $('#mic')
        .click(function () {useSettings('mic')})
        .mouseenter(function () {$('#mic ._tooltip').css({opacity: 1, top: -54})})
        .mouseleave(function () {$('#mic ._tooltip').css({opacity: 0, top: -50})});

    $('#btn-left').click(function () {

        if ((--playlistIdx) < 0) {
            playlistIdx += playlist.length;
        }
        useSettings(playlist[playlistIdx]);
    });

    $('#btn-right').click(function () {

        playlistIdx = (++playlistIdx) % playlist.length;
        useSettings(playlist[playlistIdx]);
    });

    tlPlayTitle = new TimelineMax({repeat: -1});
    tlPlayTitle.call(function () {$('#text-track').text(options.title)});
    tlPlayTitle.from('#text-track', .23, {opacity: 0});
    tlPlayTitle.to('#text-track', .23, {opacity: 0}, 3);
    tlPlayTitle.call(function () {$('#text-track').text(options.artist)});
    tlPlayTitle.to('#text-track', .23, {opacity: 1});
    tlPlayTitle.to('#text-track', .23, {opacity: 0}, 6);

    playlist.forEach(function (settingsId) {
        if (!getSettings(settingsId)) {
            alert('missing settings:' + settingsId)
        }
    });

    //seek
    !(function () {

        var progress, bcr = document.getElementById('progressbar-hit').getBoundingClientRect();

        $('#progressbar-hit').mousedown(function (e) {

            if (!aSource) {
                return;
            }

            isSeeking = true;

            onSeek(e);

            $(window).on('mousemove', onSeek);
            $(window).on('mouseup mouseleave', onSeekOff);
        });

        function onSeek(e) {

            progress = (e.pageX - bcr.left) / bcr.width;
            progress = Math.max(0, Math.min(1, progress));
            $('#progressbar-state').css('width', (progress*100)+'%');
            console.log('onSeek', e.pageX, progress, progress,bcr)
        }

        function onSeekOff(e) {

            if (e.type === 'mouseleave' && e.target !== e.currentTarget) {

                return;
            }

            isSeeking = false;

            $(window).off('mousemove', onSeek);
            $(window).off('mouseup mouseleave', onSeekOff);

            seekTrack(progress);
        }
    }());


    (function () {

        var cheat = 'set', str = '';

        $(window).keypress(function (e) {

            str += String.fromCharCode(e.charCode);
            str = str.substr(-cheat.length);

            if (str === cheat) {

                $('#modal-settings').modal('show')
            }
        });
    }());
}




















!(function () {

    var buff = [], recSetI, recRaf, timeLastRec, timeStartRec, mspf, dropped;

    $('#btn-rec-start').click(function () {

        if (isRecording === true) {
            return;
        }
        isRecording = true;

        buff.length = 0;
        dropped = 0;
        mspf = 1000 / parseInt($('#rec-fps').val());
        timeStartRec = timeStartRec = window.performance.now();

        // clearInterval(recSetI);
        // recSetI = setInterval(rec, 1);
        rec();
    });

    $('#btn-rec-stop').click(function () {

        if (isRecording === false) {
            return;
        }
        isRecording = false;

        // clearInterval(recSetI);
        window.cancelAnimationFrame(rec);

        alert('frames:' + buff.length + ' dropped:' + dropped);
    });

    function rec() {

        recRaf = window.requestAnimationFrame(rec);

        var now = window.performance.now(),
        diff = now - timeLastRec;

        if (diff > 0) {
            var str = cStage.toDataURL('image/png');
            buff.push(str.substr(22))
            // buff.push(new Uint8Array(ctxStage.getImageData(0, 0, cStage.width, cStage.height).data));
        }

        if (diff/mspf > 1) {

            dropped += parseInt(diff/mspf);
        }

        timeLastRec = (now - (now % mspf)) + mspf;
    }

    $('#btn-rec-save').click(function () {

        var zip = new JSZip();
        // zip.file("sequence", "Hello World\n");
        var img = zip.folder("sequence");

        buff.forEach(function (imgData, idx) {

            var name = ('00000000' + idx).substr(-8);

            img.file(name + '.png', imgData, {base64: true});
        })
        var content = zip.generate({type:"blob"});
        // see FileSaver.js
        saveAs(content, "sequ.zip");
    });
}());



















function readDw() {

    $('.dw-refresh-data').remove();

    DW.settingsList = DW.settingsList || [];

    DW.settingsList.forEach(function (settings) {

        var $li = makeLi(settings.id)
            .addClass('dw-refresh-data')
            .click(useSettings.bind(null, settings));
        $('#settings-list').prepend($li);
    });
}

function micMode() {

    playStop();

    TweenMax.to('#mic .active', .34, {opacity: 1, ease: Sine.easeOut});
    TweenMax.to('#play .active', .34, {opacity: 0, ease: Sine.easeOut});
    TweenMax.to('#progressbar-state', .34, {backgroundColor: '#a6b3c2', ease: Sine.easeOut});
    $('#controls-cont .btn').off('mouseenter', onOverControlBtn);
    $('#controls-cont .btn').off('mouseleave', onOutControlBtn);
    tlPlayTitle.pause();
    TweenMax.to('#text-track, #text-time', .34, {opacity: 0, ease: Sine.easeOut});

    mode = 'mic';
    console.log('start mic')

    function gotStream(mediaStream) {

        if (mode !== 'mic') {
            return;
        }

        // resetAnalyser();
        micStream = actx.createMediaStreamSource(mediaStream);
        micStream.connect(analyser);
        analyser.connect(gainOut);
        gainOut.connect(actx.destination);
    }

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    if (navigator.getUserMedia) {

        navigator.getUserMedia( {audio:true}, gotStream, function (err) {

            console.log(err);
            playMode();
        });
    }
    else {
        playMode();
    }
}

function micStop() {

    if(micStream) {

        micStream.mediaStream.stop();
        micStream.disconnect();
        micStream = undefined;
    }
}

function playMode() {

    micStop();

    TweenMax.to('#mic .active', .34, {opacity: 0, ease: Sine.easeOut});
    TweenMax.to('#play .active', .34, {opacity: 1, ease: Sine.easeOut});
    TweenMax.to('#progressbar-state', .34, {backgroundColor: '#000000', ease: Sine.easeOut});
    tlPlayTitle.resume();
    TweenMax.to('#text-track, #text-time', .34, {opacity: 1, ease: Sine.easeOut});

    mode = 'play';

    $('#controls-cont .btn').on('mouseenter', onOverControlBtn);
    $('#controls-cont .btn').on('mouseleave', onOutControlBtn);
}

function playStop() {

    currLoadingTrack = undefined;

    if (aSource) {
        console.log('playStoped');
        aSource.stop(0);
        aSource.disconnect();
        aSource = undefined;
    }
}

function onOverControlBtn() {
    TweenMax.to($(this).find('.over'), .34, {opacity: 1, ease: Sine.easeOut});
}
function onOutControlBtn() {
    TweenMax.to($(this).find('.over'), .34, {opacity: 0, ease: Sine.easeOut});
}

function getSettings(id) {

    var ret;

    DW.settingsList.forEach(function (settings) {

        if (settings.id === id) {

            ret = settings;
        }
    });

    return ret;
}

function useSettings(settings) {

    if (typeof(settings) === 'string') {

        settings = getSettings(settings);
    }

    if (aSettings === settings) {

        return;
    }

    aSettings = settings;

    location.hash = aSettings.id;
    $('#save-settings #input-id').val(aSettings.id);

    $('#settings-title').text(settings.id);

    settings.ranges.forEach(function (range) {
        options[range.name] = range.value;
        $('#range-'+range.name).val(range.value);
    });

    DW.wordList.forEach(function (word) {

        if(word.id === settings.wordId) {

            selectWord(word);
        }
    });

    if (settings.mode === 'mic') {
        micMode();
    }
    else {
        tracks.forEach(function (track) {

            if(track.name === settings.trackName) {

                playTrack(track);
            }
        });
    }

    renderWord();
}

function saveSettings(settingsId) {

    var settings = {
        id: settingsId,
        ranges: [],
        mode: mode,
        trackName: aTrack && aTrack.name,
        wordId: aWord.id
    };

    // $('input.range').each(function () {
    //     settings.ranges.push({
    //         name: $(this).attr('id').substr(6),
    //         value: $(this).val()
    //     })
    // });

    Object.keys(options).forEach(function (key) {

        settings.ranges.push({
            name: key,
            value: options[key]
        });
    });

    for (var i = 0; i < DW.settingsList.length; ++i) {

        if (DW.settingsList[i].id === settingsId &&
            confirm('van mar mentes ezen a neven, toroljem?'))
        {
            DW.settingsList.splice(i--, 1);
        }
    }

    DW.settingsList.push(settings);
    useSettings(settings);
    readDw();
    saveDw();
}

function deleteSettings() {

    var idx = DW.settingsList.indexOf(aSettings);

    if (idx !== -1) {

        DW.settingsList.splice(idx, 1);
    }

    readDw();
    saveDw();
}

function saveDw() {

    login(function () {

        $.post(phpRoot + 'edit.php', {data: JSON.stringify(DW)}, function (res) {

            if (res === 'success') {
            }
            else {
                alert(res);
            }
        });
    });
}

function login(cb) {

    $.post(phpRoot + 'checklogin.php', '', function (res) {

        if (res === '1') {
            cb();
        }
        else {
            $('#modal-login').modal('show');
        }
    });
}

function selectWord(word) {

    aWord = word;

    word.wordpieceList.forEach(function (wp) {
        wp.bucket = [];
        wp.jump = PI2 * Math.random();
        wp.db = 0;
        wp.dbs = 0;
        wp.offX = parseFloat(wp.offX);
        wp.offY = parseFloat(wp.offY);
        wp.speed = parseFloat(wp.speed);
        wp.hzMin = parseFloat(wp.hzMin);
        wp.hzMax = parseFloat(wp.hzMax);

        DW.glyphList.forEach(function (glyph) {

            if (glyph.id === wp.glyphId) {
               wp.glyph = glyph;
            }
        });
    });
}





















function makeLi(text) {
    return $('<li><a class="dynamic-data" href="javascript:void(0)">'+text+'</a></li>');
}

function makeRange(name, value, min, max, step, onChange, type) {

    type = type || 'number';

    return  $('<div class="input-group">')
        .append($('<input id="range-'+name+'" type="'+type+'" class="form-control range">')
            .attr({
                value: value,
                min: min,
                max: max,
                step: step
            })
            .on('change input', function () {
                if (type === 'number') this.value = parseFloat(this.value);
                onChange(this.value);
            }))
        .append($('<span class="input-group-addon">').text(name))
        .appendTo('#controls')

}

function dragenter(e) {
    console.log('dragenter');
    e.stopPropagation();
    e.preventDefault();
}

function dragover(e) {
    console.log('dragover');
    e.stopPropagation();
    e.preventDefault();
}

function drop(e) {
    console.log('drop');
    e.stopPropagation();
    e.preventDefault();

    var dt = e.dataTransfer;
    var files = dt.files;

    handleFiles(files);
}

function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
        var file = files[i];

        // var img = document.createElement("img");
        // img.classList.add("obj");
        // img.file = file;
        // preview.appendChild(img);

        var reader = new FileReader();
        reader.onload = function (e) {

            actx.decodeAudioData(reader.result, function (buff) {
                var track = {
                    name: file.name,
                    buff: buff
                };
                addTrack(track);
                playTrack(track);
            });
        };
        reader.readAsArrayBuffer(file);
    }
}

function playTrack(track) {

    playMode();
    tlPlayTitle.restart();
    $('#text-track').text(aSettings.title);
    $('#progressbar-state').css('width', 0);

    if (aSource) {
        aSource.stop(0);
        aSource.disconnect();
        aSource = undefined;
    }

    if (!track.buff) {

        $('#text-time').text('loading...');

        if (!track.onLoad) {

            currLoadingTrack = track;

            track.onLoad = true;

            loadTrack(track.url, function (buff) {

            track.onLoad = false;

                track.buff = buff;

                if (currLoadingTrack === track) {

                    playTrack(track);
                }

                currLoadingTrack = undefined;
            });
        }

        return;
    }

    $('#text-time').text('...');

    aTrack = track;

    // resetAnalyser();
    aSource = actx.createBufferSource();
    aSource.buffer = aTrack.buff;
    aSource.connect(analyser);
    timeStartTrack = +new Date();
    aSource.start(0);
    window.requestAnimationFrame(animPlayProgress);
}

function seekTrack(percent) {

    if (!aSource || !aTrack) {
        return;
    }

    percent = Math.max(0, Math.min(1, percent));

    // resetAnalyser();
    aSource.stop(0);
    aSource.disconnect();
    aSource = actx.createBufferSource();
    aSource.buffer = aTrack.buff;
    aSource.connect(analyser);
    var offset = aTrack.buff.duration * percent;
    timeStartTrack = +new Date() - (offset * 1000);
    aSource.start(0, offset);
}

function animPlayProgress() {

    var timeCurr = +new Date() - timeStartTrack,
        progress = (timeCurr/1000) / aTrack.buff.duration;


    if (progress < 1 && mode === 'play' && aSource) {
        window.requestAnimationFrame(animPlayProgress);
    }
    else if (progress >= 1) {
        progress = 1;
        useSettings(playlist[(++playlistIdx) % playlist.length]);
    }

    if (!currLoadingTrack) {

        timeCurr = ~~(timeCurr/1000);
        var min = ('0' + parseInt(timeCurr / 60)).substr(-2);
        var sec = ('0' + (timeCurr % 60)).substr(-2);
        $('#text-time').text(min+':'+sec);
    }

    if (!isSeeking) {

        $('#progressbar-state').css('width', (progress*100)+'%')
    }
}






















function render(){

    window.requestAnimationFrame(render);

    var i, freqByteData, freq, count, fStep;

    freqByteData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqByteData);
    count = analyser.frequencyBinCount;
    fStep = actx.sampleRate / count;

    if (isSettingsOpen &&  !isRecording) {
        ctxPreview.clearRect(0, 0, cPreview.width, cPreview.height);

        for(i = 0; i < count; ++i) {

            ctxPreview.fillRect(i/2,cPreview.height,.5,-freqByteData[i]);
        }
    }

    if (!aWord) {
        return;
    };

    aWord.wordpieceList.forEach(function (wp) {

        var full = 0;

        count = ~~(wp.hzMax/fStep);
        for (i = ~~(wp.hzMin/fStep); i < count; ++i) {

            full += freqByteData[i];
        }
        wp.db = full / ((wp.hzMax - wp.hzMin) / fStep);
    });

    renderWord();
}

function renderWord() {

    var commands0, commands1, cmd0, cmd1, pos, ctx = ctxStage, now = +new Date;

    ctxStage.clearRect(0, 0, cStage.width, cStage.height);
    // cStage.width = window.innerWidth;
    // cStage.height = window.innerHeight;

    aWord.wordpieceList.forEach(function (wp, idx) {

        var step = wp.speed * ((now - lastRender)/1000), pos, f;
        wp.jump = (wp.jump + step) % PI2;

        switch (wp.waveform) {
            case 'cos':
                pos = Math.cos(wp.jump);

            case 'sin':
                pos = Math.cos(wp.jump);

            case 'sin(sin)':
                pos = Math.sin(Math.sin(wp.jump)*PIp2);

            case 'sin(sin(sin))':
            default:
                pos = Math.sin(Math.sin(Math.sin(wp.jump)*PIp2)*PIp2)

        }

        f = pos * wp.db / 256

        if (f < 0) {
            commands0 = wp.glyph.paths.min;
            commands1 = wp.glyph.paths.normal;
            pos = f + 1;
        }
        else {
            commands0 = wp.glyph.paths.normal;
            commands1 = wp.glyph.paths.max;
            pos = f;
        }

        // wp.dbs += ((wp.db / 256) - wp.dbs) / 60;
        // pos *= wp.dbs;
        // console.log(pos);

        ctx.save();
        ctx.scale(options.globalRenderScale, options.globalRenderScale);
        ctx.translate(wp.offX + options.renderX, wp.offY + options.renderY);
        ctx.beginPath();

        for (var i = 0; i < commands0.length; i += 1) {

            cmd0 = commands0[i];
            cmd1 = commands1[i];

            if (cmd0.type === 'M') {
                ctx.moveTo(a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
            } else if (cmd0.type === 'L') {
                ctx.lineTo(a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
            } else if (cmd0.type === 'C') {
                ctx.bezierCurveTo(a(cmd0.x1,cmd1.x1), a(cmd0.y1,cmd1.y1), a(cmd0.x2,cmd1.x2), a(cmd0.y2,cmd1.y2), a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
            } else if (cmd0.type === 'Q') {
                ctx.quadraticCurveTo(a(cmd0.x1,cmd1.x1), a(cmd0.y1,cmd1.y1), a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
            } else if (cmd0.type === 'Z') {
                ctx.closePath();
            }
        }


        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();

        function a(v0, v1) {
            var ret = (v0 + (v1 - v0) * pos) * options.renderScale;
            return ret;
        }
    });

    lastRender = now;
}











function addTrack(track) {

    tracks.push(track);

    $('<li><a href="#">'+track.name+'</a></li>')
        .appendTo('#select-track ul')
        .click(playTrack.bind(null, track));
}

function loadTrack(url, cb) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';

  request.onload = function() {
    actx.decodeAudioData(request.response, function(buffer) {
      cb(buffer);
    }, function () {
        alert('error on decoding file: ' + url);
    });
  }
  request.send();
}

function selectInput(inputBox) {

    $('.input-box').removeClass('.alert-info');
    $(inputBox).addClass('.alert-info');
}


function showOldBrowserWarning() {

    var $cont = $('<div>')
        .css({
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(255,255,255, 1)',
            opacity: 1
        })
        .appendTo('body')
        .click(function () {
            window.open('http://www.google.com/intl/hu_HU/chrome/browser/')
        });

    var $msg = $('<img>')
        .attr('src', 'assets/img/warning_old_browser.png')
        .css({
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            margin: 'auto',
            display: 'block'
        })
        .appendTo($cont);

    // TweenMax.to($cont, .36, {autoAlpha: 1})
}
