var ip;
var start_ip = [];
var end_ip = [];
var port;
var ws;
var start_time;
var current_ip = [];
var closed_port_max = 2000;
var ns_hosts_up = [];
var private_ip = '';
var public_ip = '';
var ip_scan_start = 0;
var ip_scan_end = 255;
var default_port_check = [80, 443, 8080];
var blocked_ports = [0, 1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42,
    43, 53, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115,
    117, 119, 123, 135, 139, 143, 179, 389, 465, 512, 513, 514, 515, 526,
    530, 531, 532, 540, 556, 563, 587, 601, 636, 993, 995, 2049, 4045, 6000
];
//1. get the local ip
//2. split the ip addr
//3. start scan from gateway till 255.
//4. check if other gateway also present
function getIPs(callback) {
    var ip_dups = {};
    var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection ||
            window.webkitRTCPeerConnection;
    var useWebKit = !!window.webkitRTCPeerConnection;
    if (!RTCPeerConnection) {
        var win = iframe.contentWindow;
        RTCPeerConnection = win.RTCPeerConnection || win.mozRTCPeerConnection ||
                win.webkitRTCPeerConnection;
        useWebKit = !!win.webkitRTCPeerConnection;
    }
    var mediaConstraints = {
        optional: [{
                RtpDataChannels: true
            }]
    };
    var servers = undefined;
    if (useWebKit) {
        servers = {
            iceServers: [{
                    urls: "stun:stun.services.mozilla.com"
                }]
        };
    }
    var pc = new RTCPeerConnection(servers, mediaConstraints);

    function handleCandidate(candidate) {
        var ip_regex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        var ip_addr = ip_regex.exec(candidate)[1];
        if (ip_dups[ip_addr] === undefined)
            callback(ip_addr);
        ip_dups[ip_addr] = true;
    }
    pc.onicecandidate = function(ice) {
        console.log(ice);
        if (ice.candidate)
            handleCandidate(ice.candidate.candidate);
    };
    pc.createDataChannel("");
    pc.createOffer(function(result) {
        pc.setLocalDescription(result, function() {
        }, function() {
        });
    }, function() {
    });
    setTimeout(function() {
        var lines = pc.localDescription.sdp.split('\n');
        lines.forEach(function(line) {
            if (line.indexOf('a=candidate:') === 0)
                handleCandidate(line);
        });
    }, 1000);
}

getIPs(function(ip) {
    var li = document.createElement("li");
    li.textContent = ip;
    //local IPs
    if (ip.match(
            /^(192\.168\.|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01]))/)) {
        private_ip = ip;
        current_ip = ip.split(".");
        startScan();
        document.getElementById("private_ip").appendChild(li);
        //assume the rest are public IPs
    } else {
        public_ip = ip;
        current_ip = ip.split(".");
        document.getElementById("public_ip").appendChild(li);
    }

});

function startScan() {
    start_ip = JSON.parse(JSON.stringify(current_ip));
    start_ip[3] = ip_scan_start;

    end_ip = JSON.parse(JSON.stringify(current_ip));
    end_ip[3] = ip_scan_end;

    current_ip = start_ip;

    port = 80;
    setTimeout("network_scan()", 1);

}

function network_scan() {
    if (check_init_ip()) {
        return;
    }
    start_time = (new Date).getTime();
    try {
        ws = new WebSocket("ws://" + current_ip.join(".") + ":" + port);
        setTimeout("check_ping_status()", 200);
    } catch (err) {
        console.log(err);
        return;
    }
}

function copy_ip(source) {
    var dest = [];
    for (var i = 0; i < source.length; i++) {
        dest[i] = source[i];
    }
    return dest;
}

function check_ping_status() {
    var interval = (new Date).getTime() - start_time;
    if (ws.readyState === 0) {
        if (interval > closed_port_max) {
            var li = document.createElement("li");
            li.textContent = current_ip.join(".") + " , ";
            try {
                ws.close();
            } catch (err) {

            }
            document.getElementById("dead_private_ip").appendChild(li);
            setTimeout("network_scan()", 1);
        } else {
            setTimeout("check_ping_status()", 200);
        }
    } else {
        var li = document.createElement("li");
        li.textContent = current_ip.join(".") + " , ";
        try {
            ws.close();
        } catch (err) {

        }
        document.getElementById("live_private_ip").appendChild(li);
        ns_hosts_up.push(current_ip.join("."));
        setTimeout("network_scan()", 1);
    }
}

function end_scan() {
    current_ip[3] = ip_scan_end;
}

function check_init_ip() {
    if (current_ip[3] === ip_scan_end) {
        log_result();
        return true;
    } else {
        current_ip = increment_ip(current_ip);
    }
    return false;
}

function increment_ip(inc_ip) {
    if (inc_ip[3] < 255) {
        inc_ip[3]++;
    }
    return inc_ip;
}

function log_result() {
    console.log(ns_hosts_up);
}
