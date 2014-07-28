'use strict';

var DW, aGlyph, aWord, aWordpiece, font, cGlyph, ctxGlyph, cWord, ctxWord,
    glyphState = 0, glyphEditState = 0, dispScale = 3,
    glyphDispOffX = 120, glyphDispOffY = 280, aWorkspace, history = [],
    phpRoot = 'php/', unsaved = false,
    urm = new UndoRedoManager;

var selectedGlyphPoint = {
    isEmpty: true,
    set:function (command, xName, yName, skipHistory) {

        if (!skipHistory) {
            urm.save(
                this.set, this.set,
                this, this,
                [this.command, this.xName, this.yName, true], [command, xName, yName, true]
            )
        }

        this.command = command;
        this.xName = xName;
        this.yName = yName;
        this.isEmpty = false;

        $('#input-glyph-point-x').val(this.x());
        $('#input-glyph-point-y').val(this.y());
        renderGlyph();
    },
    clear: function () {
        this.isEmpty = true;
    },
    x: function (val) {
        if (val !== undefined) {
            this.command[this.xName] = parseFloat(val);
        }
        return this.command[this.xName];
    },
    y: function (val) {
        if (val !== undefined) {
            this.command[this.yName] = parseFloat(val);
        }
        return this.command[this.yName];
    }
}

$(document).ready(function () {

    $.getJSON('dw.json', function (_dw) {

        DW = _dw;
        init();
    });
});

function init() {

    selectWorkspace('glyph');

    cGlyph = document.getElementById('stage-glyph');
    ctxGlyph = cGlyph.getContext('2d');
    cGlyph.addEventListener('mousedown', onGlyphMDown);

    cWord = document.getElementById('stage-word');
    ctxWord = cWord.getContext('2d');

    readDw();

    $('#modal-new-glyph #btn-ok').click(function () {
        var id = $('#modal-new-glyph #input-id').val();
        var glyphIdx = $('#modal-new-glyph #input-character-idx').val();

        newGlyph(id, glyphIdx);
        selectGlyph(id);
    });

    $('#modal-copy-glyph #btn-ok').click(function () {
        var id = $('#modal-copy-glyph #input-id').val();

        copyGlyph(id);
        selectGlyph(id);
    });

    $('#modal-new-glyph #input-character').on('change input', function () {
        var c = $('#modal-new-glyph #input-character').val().charAt(0);
        $('#modal-new-glyph #input-character-idx').val(font.charToGlyphIndex(c));
    });

    $('#modal-new-word #btn-ok').click(function () {
        var id = $('#modal-new-word #input-id').val();

        newWord(id);
        selectWord(id);
    });

    $('#modal-copy-word #btn-ok').click(function () {
        var id = $('#modal-copy-word #input-id').val();

        copyWord(id);
        selectWord(id);
    });


    $('#modal-new-wordpiece #btn-ok').click(function () {
        var glyph = getGlyphById($('#modal-new-wordpiece .dropdown-toggle').text());

        if (glyph) {
            newWordpiece(glyph.id);
        }
    });

    $('#modal-delete-glyph #btn-ok').click(function () {
        deleteGlyph(aGlyph);
    });

    $('#modal-delete-word #btn-ok').click(function () {
        deleteWord(aWord);
    });

    $('#modal-delete-wordpiece #btn-ok').click(function () {
        deleteWordpiece(aWordpiece)
    });


    $('button#save').click(function() {

        login(function () {

            $.post(phpRoot + 'edit.php', {data: JSON.stringify(DW)}, function (res) {

                if (res === 'success') {
                    setUnsaved(false);
                }
                else {
                    alert(res);
                }
            });
        });
    });

    $('#btn-undo').click(urm.undo.bind(urm));

    $('#btn-redo').click(urm.redo.bind(urm));

    $('#modal-login #btn-ok').click(function () {

        var url = phpRoot + 'int.php',
            pwd = $('#modal-login #input-pwd').val();

        $.post( url, { data: pwd }, function (res) {
            alert(res)
        });
        $('#modal-login').modal('hide');
    });

    $("input:radio[name=animpos]").change(function() {
        var value = $(this).val();
        glyphState = glyphEditState = parseInt(value);
        selectedGlyphPoint.clear();
        $("#glyph-state-range").val(glyphEditState);

        renderGlyph();
    });

    $("#glyph-state-range").on('change input', function() {
        glyphState = parseFloat($(this).val());
        renderGlyph();
    })
    .on('mouseup mouseleave', function () {
        TweenMax.to("#glyph-state-range", .8, {
            value: glyphEditState,
            ease: glyphEditState === 0 ? Elastic.easeOut : Bounce.easeOut,
            onUpdate: function () {
                $("#glyph-state-range").change();
            }
        });
    });


    $('#input-glyph-point-x, #input-glyph-point-y').on('change input', function () {
        editSelectedGlyphPoint($('#input-glyph-point-x').val(), $('#input-glyph-point-y').val());
    })

    $('input #wordpiece-minhz').on('change input', function () {
        editWordpiece('minHz', $(this).val());
    });

    $('input #wordpiece-maxhz').on('change input', function () {
        editWordpiece('maxHz', $(this).val());
    });

    $('input #wordpiece-left').on('change input', function () {
        editWordpiece('left', $(this).val());
    });

    $('input #wordpiece-top').on('change input', function () {
        editWordpiece('top', $(this).val());
    });

    $('input').tooltip();

    $('.navbar-brand').click(toogleWorkspace);


    $.getJSON('assets/fonts.json', function (fontList) {

        $('#font-list').empty();

        fontList.forEach(function (src) {

            var $li = makeLi(src)
                .click(function () {

                    $('#modal-new-glyph #btn-ok').attr('disabled', 'disabled');
                    $('#btn-font-list').text('loading...');

                    opentype.load(src, function (err, _font) {
                        font = _font;
                        $('#btn-font-list').text(src);
                        $('#modal-new-glyph #btn-ok').removeAttr('disabled');
                    });
                })
                .appendTo('#font-list');
        });
    });

    $('#btn-next-point, #btn-prev-point').click(function () {

        if (selectedGlyphPoint.isEmpty) {
            return;
        }

        var editStateName = ['min', 'normal', 'max'][glyphEditState+1];
        var commands = aGlyph.paths[editStateName];
        var idx = commands.indexOf(selectedGlyphPoint.command);
        if (idx !== -1) {

            idx += this.id === 'btn-next-point' ? 1 : -1;
            idx %= commands.length;
            if (idx < 0) idx += commands.length;
            selectedGlyphPoint.set(commands[idx]);
        }

    });
};

function login(cb) {

    $.post(phpRoot + 'checklogin.php', '', function (res) {

        if (res === '1') {
            cb();
        }
        else {
            $('#modal-login').modal('show');
        }
    })
}

function readDw() {

    $('.dw-refresh-data').remove();

    DW.glyphList.forEach(function (glyph) {

        var $li = makeLi(glyph.id)
            .addClass('dw-refresh-data')
            .click(selectGlyph.bind(null, glyph.id));
        $('#glyph-list').prepend($li);

        $li = makeLi(glyph.id)
            .addClass('dw-refresh-data')
            .click(function () {
                $('#modal-new-wordpiece .dropdown-toggle').text(glyph.id);
            });
        $('#modal-new-wordpiece #glyph-list').prepend($li);
    });


    DW.wordList.forEach(function (word) {

        var $li = makeLi(word.id)
            .addClass('dw-refresh-data')
            .click(selectWord.bind(null, word.id));
        $('#word-list').prepend($li);
    });

    if (DW.glyphList.indexOf(aGlyph) === -1) {
        selectGlyph(DW.glyphList[DW.glyphList.length-1].id);
    }

    if (DW.wordList.indexOf(aWord) === -1) {
        selectWord(DW.wordList[DW.wordList.length-1].id);
    }
}

function makeLi(text) {
    return $('<li><a href="javascript:void(0)">'+text+'</a></li>');
}

function toogleWorkspace() {

    if (aWorkspace === 'word') {

        selectWorkspace('glyph');
        dispScale = 3;
    }
    else {
        selectWorkspace('word');
        dispScale = 1.2;
    }

    renderGlyph();
    renderWord();
}

function selectWorkspace(id) {

    if (id === 'glyph') {

        aWorkspace = 'glyph';
        $('.navbar-brand').text('Glyph');

        $('.ws-word').hide();
        $('.ws-glyph').show();
    }
    else if (id === 'word') {

        aWorkspace = 'word';
        $('.navbar-brand').text('Word');

        $('.ws-glyph').hide();
        $('.ws-word').show();
    }
}

function selectGlyph(id) {

    if (aGlyph && aGlyph.id === id) return;

    var glyph = getGlyphById(id);
    if (glyph) {

        aGlyph = glyph;

        $('.dropdown#glyph .dropdown-toggle small').text(aGlyph.id);

        selectedGlyphPoint.clear();

        $('ul#point-list').empty();

        aGlyph.paths.normal.forEach(function (cmd, idx) {

            var cmds = [
                aGlyph.paths.min[idx],
                aGlyph.paths.normal[idx],
                aGlyph.paths.max[idx]
            ];

            makeLiPoint('#'+idx+' / '+cmd.type, cmds, 'x', 'y');

            if (cmd.hasOwnProperty('x1')) {
                makeLiPoint('>    1', cmds, 'x1', 'y1');
            }

            if (cmd.hasOwnProperty('x2')) {
                makeLiPoint('>    2', cmds, 'x2', 'y2');
            }
        });

        renderGlyph();
    }

    function makeLiPoint(name, cmds, x, y) {
        makeLi(name)
            .click(function () {
                selectedGlyphPoint.set(cmds[glyphEditState+1], x, y);
            })
            .appendTo('ul#point-list');
    }
}

function selectWord(id) {

    var word = getWordById(id);
    if (!word) {
        return;
    }

    aWord = word;

    $('.dropdown#word .dropdown-toggle small').text(aWord.id);

    $('#wordpiece-list .wp-idx').remove();

    renderWord();

    aWord.wordpieceList.forEach(function (data, idx) {

        var $li = makeLi(idx)
            .click(selectWordpiece.bind(null, idx))
            .addClass('wp-idx');
        $('#wordpiece-list').prepend($li);
    });

    if (aWord.wordpieceList.indexOf(aWordpiece) === -1) {
        selectWordpiece(0);
    }
}

function selectWordpiece(idx) {

    if(!aWord || aWord.wordpieceList.length <= idx) {
        return;
    }

    aWordpiece = aWord.wordpieceList[idx];

    $('.dropdown#wordpiece .dropdown-toggle small').text(idx);

    ['hzMin', 'hzMax', 'speed', 'offX', 'offY'].forEach(function (pn) {

        $('input#wordpiece-' + pn)
            .val(aWordpiece[pn])
            .off('change')
            .on('change', function () {
                aWordpiece[pn] = this.value;
                renderWord();
                setUnsaved(true);
            });
    });
}

function getGlyphById(id) {

    var ret;

    DW.glyphList.forEach(function (glyph) {
        if (glyph.id === id) {

            ret = glyph;
        }
    });

    return ret;
}

function getWordById(id) {

    var ret;

    DW.wordList.forEach(function (word) {
        if (word.id === id) {

            ret = word;
        }
    });

    return ret;
}


function getCommandsBounds(commands) {

    var top, bottom, left, right;

    commands.forEach(function (cmd) {

        if (top === undefined || cmd.y < top) top = cmd.y;
        if (top === undefined || cmd.y > bottom) bottom = cmd.y;
        if (top === undefined || cmd.x < left) left = cmd.x;
        if (top === undefined || cmd.x > right) right = cmd.x;
    })
}

function onGlyphMDown(e) {

    if (!aGlyph) {
        return;
    }

    var closest, dist, xName, yName,
        mx = (e.offsetX - glyphDispOffX) / dispScale,
        my = (e.offsetY - glyphDispOffY) / dispScale,
        editStateName = ['min', 'normal', 'max'][glyphEditState+1];

    aGlyph.paths[editStateName].forEach(function (cmd) {

        if (getDist(cmd.x, cmd.y)) {
            closest = cmd;
            xName = 'x';
            yName = 'y';
        }

        if ((cmd.type === 'C' || cmd.type === 'Q') && getDist(cmd.x1, cmd.y1)) {
            closest = cmd;
            xName = 'x1';
            yName = 'y1';
        }

        if (cmd.type === 'C' && getDist(cmd.x2, cmd.y2)) {
            closest = cmd;
            xName = 'x2';
            yName = 'y2';
        }
    });

    if (dist < 4) {
        selectedGlyphPoint.set(closest, xName, yName);
        editSelectedGlyphPoint(selectedGlyphPoint.x(), selectedGlyphPoint.y());

        $(window).on('mousemove', mMove);
        $(window).on('mouseup mouseleave', dragEnd);
    }

    function mMove(e) {
        var x = (e.offsetX - glyphDispOffX) / dispScale,
            y = (e.offsetY - glyphDispOffY) / dispScale;

        editSelectedGlyphPoint(x, y, true);

        renderGlyph();
    }

    function dragEnd() {
        editSelectedGlyphPoint(selectedGlyphPoint.x(), selectedGlyphPoint.y());
        $(window).off('mousemove', mMove);
        $(window).off('mouseup mouseleave', dragEnd);
    }

    function getDist(x, y) {

        var dx = x - mx;
        var dy = y - my;
        var d = Math.sqrt(dx*dx + dy*dy);

        if (dist === undefined || d < dist) {
            dist = d;
            return true;
        }
    }
}


function renderGlyph() {

    var commands0, commands1, pos, editStateName;

    if (glyphState < 0) {
        commands0 = aGlyph.paths.min;
        commands1 = aGlyph.paths.normal;
        pos = glyphState + 1;
    }
    else {
        commands0 = aGlyph.paths.normal;
        commands1 = aGlyph.paths.max;
        pos = glyphState;
    }

    editStateName = ['min', 'normal', 'max'][glyphEditState+1];

    ctxGlyph.clearRect(0, 0, cGlyph.width, cGlyph.height);
    drawGlyph(ctxGlyph, commands0, commands1, pos);
    drawGlyphControls(ctxGlyph, aGlyph.paths[editStateName], aGlyph.paths[editStateName], 0);
}

function renderWord() {

    if (!aWord) {
        return;
    }

    ctxWord.clearRect(0, 0, cWord.width, cWord.height);

    aWord.wordpieceList.forEach(function (wp) {

        var glyph = getGlyphById(wp.glyphId);
        ctxWord.save();
        ctxWord.translate(wp.offX*dispScale, wp.offY*dispScale);
        drawGlyph(ctxWord, glyph.paths.normal, glyph.paths.normal, 0);
        ctxWord.restore();
    });
}

function drawGlyph(ctx, commands0, commands1, p) {

    var i, cmd0, cmd1;

    ctx.save();
    ctx.translate(glyphDispOffX, glyphDispOffY);
    ctx.beginPath();

    for (i = 0; i < commands0.length; i += 1) {

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
        return (v0 + (v1 - v0) * p) * dispScale;
    }
};

function drawGlyphControls(ctx, commands0, commands1, p) {

    var i, cmd0, cmd1;

    ctx.save();
    ctx.translate(glyphDispOffX, glyphDispOffY);
    ctx.beginPath();

    for (i = 0; i < commands0.length; i += 1) {

        cmd0 = commands0[i];
        cmd1 = commands1[i];

        if (cmd0.type === 'M') {
            point(a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
        } else if (cmd0.type === 'L') {
            point(a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
        } else if (cmd0.type === 'C') {
            control(a(cmd0.x1,cmd1.x1), a(cmd0.y1,cmd1.y1));
            control(a(cmd0.x2,cmd1.x2), a(cmd0.y2,cmd1.y2));
            point(a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
        } else if (cmd0.type === 'Q') {
            control(a(cmd0.x1,cmd1.x1), a(cmd0.y1,cmd1.y1));
            point(a(cmd0.x,cmd1.x), a(cmd0.y,cmd1.y));
        }
    }

    if (!selectedGlyphPoint.isEmpty) {

        selected(selectedGlyphPoint.x() * dispScale, selectedGlyphPoint.y() * dispScale)
    }

    ctx.restore();

    function a(v0, v1) {
        return (v0 + (v1 - v0) * p) * dispScale;
    }

    function circle(x, y, color, width) {

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI*2);
        ctx.stroke()
    }

    function point(x, y) {
        circle(x, y, '#f77', 2)
    }

    function control(x, y) {
        circle(x, y, '#7f7', 2)
    }

    function selected(x, y) {
        circle(x, y, '#77f', 4)
    }
};

//--------------------------------------------------------------------------------------------------
//--DW Modifiers------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------

function newGlyph(id, glyphIdx) {

    if (!id || glyphIdx === undefined || getGlyphById(id)) {
        return;
    }

    id = id.replace(/"/g, "'");

    if (!font) {
        alert('nincs font kivalasztva!');
        return;
    }

    var path = font.glyphs[glyphIdx].getPath();

    for (var i = 0; i < path.length; ++i) {


    }

    DW.glyphList.push({
        id: id,
        paths: {
            min: JSON.parse(JSON.stringify(path.commands)),
            normal: JSON.parse(JSON.stringify(path.commands)),
            max: JSON.parse(JSON.stringify(path.commands))
        }
    });

    setUnsaved(true);
    readDw();
}

function copyGlyph(id) {

    if (!id || !aGlyph || getGlyphById(id)) {
        return;
    }

    id = id.replace(/"/g, "'");

    var glyph = JSON.parse(JSON.stringify(aGlyph));
    glyph.id = id;

    DW.glyphList.push(glyph);

    setUnsaved(true);
    readDw();
}

function newWord(id) {

    if (!id || getWordById(id)) {
        return;
    }

    id = id.replace(/"/g, "'");

    DW.wordList.push({
        id: id,
        wordpieceList: []
    });

    setUnsaved(true);
    readDw();
}


function copyWord(id) {

    if (!id || !aWord || getWordById(id)) {
        return;
    }

    id = id.replace(/"/g, "'");

    var word = JSON.parse(JSON.stringify(aWord));
    word.id = id;

    DW.wordList.push(word);

    setUnsaved(true);
    readDw();
}

function newWordpiece(glyphId) {

    aWord.wordpieceList.push({
        glyphId: glyphId,
        hzMin: 0,
        hzMax: 0,
        speed: 0,
        offX: 0,
        offY: 0
    });

    selectWord(aWord.id);
    selectWordpiece(aWord.wordpieceList.length - 1);

    setUnsaved(true);
    readDw();
}



function deleteGlyph(glyph) {

    deleteItem(DW.glyphList, glyph);
}
function deleteWord(word) {

    deleteItem(DW.wordList, word);
}
function deleteWordpiece(wordpiece) {

    deleteItem(aWord.sequence, wordpiece);
}
function deleteItem(list, item) {

    var idx;
    if ((idx = list.indexOf(item)) !== -1) {

        list.splice(idx, 1);
    }
    setUnsaved(true);
    readDw();
}


function editGlyph(paramName, value) {

    editItem(aGlyph, paramName, value);
}
function editWord(paramName, value) {

    editItem(aWord, paramName, value);
}
function editWordpiece(paramName, value) {

    editItem(aWordpiece, paramName, value);
}
function editItem(item, paramName, value) {

    item[paramName] = value;
    setUnsaved(true);

    renderGlyph();
}


function editSelectedGlyphPoint(x, y, skipHistory) {

    if (selectedGlyphPoint.isEmpty) {
        return;
    }

    if (!skipHistory) {
        urm.save(editSelectedGlyphPoint, editSelectedGlyphPoint,
            null, null,
            [selectedGlyphPoint.x(), selectedGlyphPoint.y(), true], [x, y, true]);
    }

    selectedGlyphPoint.x(x);
    selectedGlyphPoint.y(y);

    renderGlyph();
    readDw();
    setUnsaved(true);

}

function setUnsaved(val) {

    if (val) {
        $('button#save').removeClass('btn-success').addClass('btn-primary');
        $('button#save span').removeClass('glyphicon-floppy-saved').addClass('glyphicon-floppy-save');
        unsaved = true;
    }
    else {
        $('button#save').removeClass('btn-primary').addClass('btn-success');
        $('button#save span').removeClass('glyphicon-floppy-save').addClass('glyphicon-floppy-saved');
        unsaved = false;
    }
}

window.onbeforeunload = function() {
    if (unsaved) {
        return "nemmentetté..."
    }
}

