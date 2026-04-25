---- MODULE ForkHandlerSendsClaudeCommand ----

EXTENDS Integers, TLC

CONSTANTS
    ParentId,
    MessageId,
    NewUUID

(*--algorithm ForkHandlerSendsClaudeCommand

variables
    phase = "Idle",
    settingsResolved \in {TRUE, FALSE},
    inheritedProvider = "claude",
    inheritedPermissionMode = "default",
    lastSentPayload = [
        type    |-> "none",
        command |-> "none",
        options |-> [
            provider        |-> "none",
            permissionMode  |-> "none",
            sessionId       |-> "none",
            resume          |-> "none",
            forkSession     |-> FALSE,
            resumeSessionAt |-> "none"
        ]
    ],
    sendMessageCalled = FALSE,
    sendMessageCallCount = 0;

define

    ChannelReuse ==
        sendMessageCalled =>
            lastSentPayload.type = "claude-command"

    ForkMarker ==
        sendMessageCalled =>
            /\ lastSentPayload.options.forkSession = TRUE
            /\ lastSentPayload.options.resume = ParentId
            /\ lastSentPayload.options.resumeSessionAt = MessageId

    FreshSessionId ==
        sendMessageCalled =>
            lastSentPayload.options.sessionId = NewUUID

    EmptyCommand ==
        sendMessageCalled =>
            lastSentPayload.command = ""

    AtMostOneSend ==
        sendMessageCallCount <= 1

    AllInvariants ==
        /\ ChannelReuse
        /\ ForkMarker
        /\ FreshSessionId
        /\ EmptyCommand
        /\ AtMostOneSend

end define;

fair process handler = "forkHandler"
begin
    InvokeFork:
        if settingsResolved then
            phase := "Dispatching";
        else
            phase := "SettingsError";
            goto Terminate;
        end if;

    SendForkMessage:
        lastSentPayload := [
            type    |-> "claude-command",
            command |-> "",
            options |-> [
                provider        |-> inheritedProvider,
                permissionMode  |-> inheritedPermissionMode,
                sessionId       |-> NewUUID,
                resume          |-> ParentId,
                forkSession     |-> TRUE,
                resumeSessionAt |-> MessageId
            ]
        ];
        sendMessageCalled := TRUE;
        sendMessageCallCount := sendMessageCallCount + 1;
        phase := "Dispatched";

    Terminate:
        skip;

end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "5e5125d1" /\ chksum(tla) = "7ef6aef6")
VARIABLES pc, phase, settingsResolved, inheritedProvider, 
          inheritedPermissionMode, lastSentPayload, sendMessageCalled, 
          sendMessageCallCount

(* define statement *)
ChannelReuse ==
    sendMessageCalled =>
        lastSentPayload.type = "claude-command"

ForkMarker ==
    sendMessageCalled =>
        /\ lastSentPayload.options.forkSession = TRUE
        /\ lastSentPayload.options.resume = ParentId
        /\ lastSentPayload.options.resumeSessionAt = MessageId

FreshSessionId ==
    sendMessageCalled =>
        lastSentPayload.options.sessionId = NewUUID

EmptyCommand ==
    sendMessageCalled =>
        lastSentPayload.command = ""

AtMostOneSend ==
    sendMessageCallCount <= 1

AllInvariants ==
    /\ ChannelReuse
    /\ ForkMarker
    /\ FreshSessionId
    /\ EmptyCommand
    /\ AtMostOneSend


vars == << pc, phase, settingsResolved, inheritedProvider, 
           inheritedPermissionMode, lastSentPayload, sendMessageCalled, 
           sendMessageCallCount >>

ProcSet == {"forkHandler"}

Init == (* Global variables *)
        /\ phase = "Idle"
        /\ settingsResolved \in {TRUE, FALSE}
        /\ inheritedProvider = "claude"
        /\ inheritedPermissionMode = "default"
        /\ lastSentPayload =                   [
                                 type    |-> "none",
                                 command |-> "none",
                                 options |-> [
                                     provider        |-> "none",
                                     permissionMode  |-> "none",
                                     sessionId       |-> "none",
                                     resume          |-> "none",
                                     forkSession     |-> FALSE,
                                     resumeSessionAt |-> "none"
                                 ]
                             ]
        /\ sendMessageCalled = FALSE
        /\ sendMessageCallCount = 0
        /\ pc = [self \in ProcSet |-> "InvokeFork"]

InvokeFork == /\ pc["forkHandler"] = "InvokeFork"
              /\ IF settingsResolved
                    THEN /\ phase' = "Dispatching"
                         /\ pc' = [pc EXCEPT !["forkHandler"] = "SendForkMessage"]
                    ELSE /\ phase' = "SettingsError"
                         /\ pc' = [pc EXCEPT !["forkHandler"] = "Terminate"]
              /\ UNCHANGED << settingsResolved, inheritedProvider, 
                              inheritedPermissionMode, lastSentPayload, 
                              sendMessageCalled, sendMessageCallCount >>

SendForkMessage == /\ pc["forkHandler"] = "SendForkMessage"
                   /\ lastSentPayload' =                    [
                                             type    |-> "claude-command",
                                             command |-> "",
                                             options |-> [
                                                 provider        |-> inheritedProvider,
                                                 permissionMode  |-> inheritedPermissionMode,
                                                 sessionId       |-> NewUUID,
                                                 resume          |-> ParentId,
                                                 forkSession     |-> TRUE,
                                                 resumeSessionAt |-> MessageId
                                             ]
                                         ]
                   /\ sendMessageCalled' = TRUE
                   /\ sendMessageCallCount' = sendMessageCallCount + 1
                   /\ phase' = "Dispatched"
                   /\ pc' = [pc EXCEPT !["forkHandler"] = "Terminate"]
                   /\ UNCHANGED << settingsResolved, inheritedProvider, 
                                   inheritedPermissionMode >>

Terminate == /\ pc["forkHandler"] = "Terminate"
             /\ TRUE
             /\ pc' = [pc EXCEPT !["forkHandler"] = "Done"]
             /\ UNCHANGED << phase, settingsResolved, inheritedProvider, 
                             inheritedPermissionMode, lastSentPayload, 
                             sendMessageCalled, sendMessageCallCount >>

handler == InvokeFork \/ SendForkMessage \/ Terminate

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == handler
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(handler)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

====
