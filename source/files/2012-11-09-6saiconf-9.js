window.addEventListener('load', function() {
    var URL = window.URL || window.webkitURL;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

    var ctx = new AudioContext();
    var mediaElement = new Audio();
    mediaElement.src = "http://tes.so/6saiconf_5/snd7.mp3";
    mediaElement.loop = true;
    var srcElement = null;

    var lowpass = ctx.createBiquadFilter();
    lowpass.type = lowpass.LOWPASS;
    var highpass = ctx.createBiquadFilter();
    highpass.type = lowpass.HIGHPASS;
    lowFreqChange();
    highFreqChange();

    var compressor = ctx.createDynamicsCompressor();
    compressorChange();

    var gain = ctx.createGainNode();
    gain.gain.value = 1;

    var srcAnalyser = ctx.createAnalyser();
    var dstAnalyser = ctx.createAnalyser();

    srcAnalyser.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(compressor);
    compressor.connect(gain);
    gain.connect(dstAnalyser);
    dstAnalyser.connect(ctx.destination);

    window.addEventListener('dragover', function(e) {
        e.preventDefault();
    }, false);
    window.addEventListener('dragenter', function(e) {
        e.preventDefault();
    }, false);
    window.addEventListener('drop', function(e) {
        e.preventDefault();
        var file = e.dataTransfer.files[0];
        mediaElement = new Audio();
        mediaElement.src = URL.createObjectURL(file);
        mediaElement.loop = true;
    }, false);

    document.getElementById('play').addEventListener('click', function() {
        if(srcElement) srcElement.disconnect();
        srcElement = ctx.createMediaElementSource(mediaElement);
        srcElement.connect(srcAnalyser);
        mediaElement.play();
    }, false);

    document.getElementById('gain').addEventListener('change', function() {
        var value = document.getElementById('gain').value / 10;
        gain.gain.value = value;
        document.getElementById('gainValue').innerText = value;
    }, false);

    document.getElementById('highFreq').addEventListener('change', highFreqChange, false);
    document.getElementById('lowFreq').addEventListener('change', lowFreqChange, false);

    function highFreqChange() {
        var high = document.getElementById('highFreq').value * 10;
        lowpass.frequency.value = high;
        document.getElementById('highValue').innerText = high;
    }

    function lowFreqChange() {
        var low = document.getElementById('lowFreq').value * 10;
        highpass.frequency.value = low;
        document.getElementById('lowValue').innerText = low;
    }

    document.getElementById('threshold').addEventListener('change', compressorChange, false);
    document.getElementById('ratio').addEventListener('change', compressorChange, false);

    function compressorChange() {
        compressor.threshold.value =
            document.getElementById('threshold').value / 10;
        compressor.ratio.value =
            document.getElementById('ratio').value / 10;
        compressor.knee.value = 0;
        compressor.attack.value = 0;
        compressor.release.value = 0;
        document.getElementById('thresholdValue').innerText = (compressor.threshold.value*10|0)/10;
        document.getElementById('ratioValue').innerText = (compressor.ratio.value*10|0)/10;
    }

    var canvasTimeDomain = document.getElementById('timeDomain');
    var canvasFrequency = document.getElementById('frequency');
    var ctxTimeDomain = canvasTimeDomain.getContext('2d');
    var ctxFrequency = canvasFrequency.getContext('2d');
    var analyserData = new Uint8Array(srcAnalyser.frequencyBinCount);
    requestAnimationFrame(function loop() {
        ctxTimeDomain.fillStyle = 'black';
        ctxTimeDomain.fillRect(0, 0, canvasTimeDomain.width, canvasTimeDomain.height);

        ctxTimeDomain.strokeStyle = 'gray';
        srcAnalyser.getByteTimeDomainData(analyserData);
        draw(ctxTimeDomain, analyserData, 0, 0, canvasTimeDomain.width, canvasTimeDomain.height);

        ctxTimeDomain.strokeStyle = 'lime';
        dstAnalyser.getByteTimeDomainData(analyserData);
        draw(ctxTimeDomain, analyserData, 0, 0, canvasTimeDomain.width, canvasTimeDomain.height);

        ctxFrequency.fillStyle = 'black';
        ctxFrequency.fillRect(0, 0, canvasFrequency.width, canvasFrequency.height);

        ctxFrequency.strokeStyle = 'gray';
        srcAnalyser.getByteFrequencyData(analyserData);
        draw(ctxFrequency, analyserData, 0, 0, canvasFrequency.width, canvasFrequency.height);

        ctxFrequency.strokeStyle = 'lime';
        dstAnalyser.getByteFrequencyData(analyserData);
        draw(ctxFrequency, analyserData, 0, 0, canvasFrequency.width, canvasFrequency.height);

        document.getElementById('reduction').innerText = compressor.reduction.value;

        requestAnimationFrame(loop);
        function draw(ctx, data, x, y, width, height) {
            var length = data.length;
            var i;
            ctx.beginPath();
            ctx.moveTo(x, (1-data[0]/255)*height+y);
            for(i = 1; i < length; ++i) {
                ctx.lineTo(x+i/length*width, (1-data[i]/255)*height+y);
            }
            ctx.stroke();
        }
    });
});