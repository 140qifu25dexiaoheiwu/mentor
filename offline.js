var Gab = {
    connection: null,

    jid_to_id: function(jid) {
        return Strophe.getBareJidFromJid(jid)
            .replace(/@/g, "-")
            .replace(/\./g, "-");
    },

    pending_subscriber: null,

    on_presence: function(presence) {
        //alert("on_presence");
        var ptype = $(presence).attr('type');
        var from = $(presence).attr('from');
        var jid_id = Gab.jid_to_id(from);

        if (ptype === 'subscribe') {
            // populate pending_subscriber, the approve-jid span, and
            // open the dialog
            Gab.pending_subscriber = from;
            $('#approve-jid').text(Strophe.getBareJidFromJid(from));
            Gab.connection.send($pres({
                to: Gab.pending_subscriber,
                "type": "subscribed"
            }));

            Gab.connection.send($pres({
                to: Gab.pending_subscriber,
                "type": "subscribe"
            }));

            Gab.pending_subscriber = null;
        }

        return true;
    },

    on_message: function(message) {
        console.log('offline message ' + message);

        var full_jid = $(message).attr('from');
        var jid = Strophe.getBareJidFromJid(full_jid);
        var jid_id = Gab.jid_to_id(jid);

        if ($('#chat-' + jid_id).length === 0) {
            $('#offline-chat-area').tabs('add', '#chat-' + jid_id, Strophe.getNodeFromJid(jid));
            $('#chat-' + jid_id).append(
                "<div class='chat-messages'></div>" +
                "<input type='text' class='chat-input'>");
        }

        $('#chat-' + jid_id).data('jid', full_jid);

        $('#offline-chat-area').tabs('select', '#chat-' + jid_id);
        $('#chat-' + jid_id + ' input').focus();

        var body = $(message).find("html > body");

        if (body.length === 0) {
            body = $(message).find('body');
            if (body.length > 0) {
                body = body.text()
            } else {
                body = null;
            }
        } else {
            body = body.contents();

            var span = $("<span></span>");
            body.each(function() {
                if (document.importNode) {
                    $(document.importNode(this, true)).appendTo(span);
                } else {
                    // IE workaround
                    span.append(this.xml);
                }
            });

            body = span;
        }

        if (body) {
            // add the new message
            $('#chat-' + jid_id + ' .chat-messages').append(
                "<div class='chat-message'>" +
                "&lt;<span class='chat-name'>" + Strophe.getNodeFromJid(jid) +
                "</span>&gt;<span class='chat-text'>" +
                "</span></div>");

            $('#chat-' + jid_id + ' .chat-message:last .chat-text')
                .append(body);

            Gab.scroll_chat(jid_id);
        }

        return true;
    },

    scroll_chat: function(jid_id) {
        var div = $('#chat-' + jid_id + ' .chat-messages').get(0);
        div.scrollTop = div.scrollHeight;
    }
};

$(document).ready(function() {

    $('#offline-chat-area').tabs().find('.ui-tabs-nav').sortable({
        axis: 'x'
    });

    var search = parseUri(window.location.search);
    $('#div-name').text('教师' + search.queryKey[Constant.username] + '离线信息');

    $(document).trigger('offline_connect', {
        jid: search.queryKey[Constant.username] + "@localhost",
        password: search.queryKey[Constant.password]
    });

    $('.chat-input').live('keypress', function(ev) {
        var jid = $(this).parent().data('jid');

        if (ev.which === 13) {
            ev.preventDefault();

            var body = $(this).val();

            var message = $msg({
                to: jid,
                "type": "chat"
            })
                .c('body').t(body).up()
                .c('active', {
                xmlns: "http://jabber.org/protocol/chatstates"
            });
            Gab.connection.send(message);

            $(this).parent().find('.chat-messages').append(
                "<div class='chat-message'>&lt;" +
                "<span class='chat-name me'>" + Strophe.getNodeFromJid(Gab.connection.jid) +
                "</span>&gt;<span class='chat-text'>" + body +
                "</span></div>");
            Gab.scroll_chat(Gab.jid_to_id(jid));

            $(this).val('');
            $(this).parent().data('composing', false);
        }
    });
});

$(document).bind('offline_connect', function(ev, data) {
    var conn = new Strophe.Connection(
        'http://localhost/http-bind');

    conn.connect(data.jid, data.password, function(status) {
        if (status === Strophe.Status.CONNECTED) {
            $(document).trigger('offline_connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('offline_disconnected');
        }
    });

    Gab.connection = conn;
});

$(document).bind('offline_connected', function() {
    console.log('offline_connected');
    Gab.connection.addHandler(Gab.on_message,
    null, "message", "chat");
    Gab.connection.addHandler(Gab.on_presence, null, "presence");

    Gab.connection.send($pres());

});

$(document).bind('offline_disconnected', function() {
    Gab.connection = null;

    $('#offline-chat-area ul').empty();
    $('#offline-chat-area div').remove();

});