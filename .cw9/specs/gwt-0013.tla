---- MODULE ForkSessionReplay ----
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS PARENT_ID, NEW_ID, ASSISTANT_UUID

ET_USER   == "user"
ET_ASST   == "assistant"
ET_RESULT == "result"

EventSeq == <<
    [etype |-> ET_USER,   esid |-> NEW_ID, isReplay |-> TRUE,  euuid |-> "r-u1"],
    [etype |-> ET_ASST,   esid |-> NEW_ID, isReplay |-> TRUE,  euuid |-> "r-a1"],
    [etype |-> ET_ASST,   esid |-> NEW_ID, isReplay |-> FALSE, euuid |-> "a2"],
    [etype |-> ET_RESULT, esid |-> NEW_ID, isReplay |-> FALSE, euuid |-> ""]
>>

\* cfg:
\*   CONSTANT PARENT_ID      = "p1"
\*   CONSTANT NEW_ID         = "n1"
\*   CONSTANT ASSISTANT_UUID = "a1"
\*   INVARIANT StreamTerminates
\*   INVARIANT NewSessionIdObserved
\*   INVARIANT AdapterNeverFails
\*   INVARIANT AdapterOutputWellFormed
\*   INVARIANT ReplayIdentityPreserved

(* --algorithm ForkSessionReplay

variables
    forkValid   \in {TRUE, FALSE},
    eventIndex  = 1,
    curEv       = [etype |-> "", esid |-> "", isReplay |-> FALSE, euuid |-> ""],
    newSidSeen  = FALSE,
    nmMalformed = FALSE,
    replayBadId = FALSE,
    streamDone  = FALSE,
    adapterErr  = FALSE,
    forkErr     = FALSE,
    phase       = "Init";

define

    StreamTerminates ==
        (forkValid /\ phase = "Complete") => streamDone

    NewSessionIdObserved ==
        (forkValid /\ phase = "Complete") => newSidSeen

    AdapterNeverFails ==
        forkValid => ~adapterErr

    AdapterOutputWellFormed ==
        ~nmMalformed

    ReplayIdentityPreserved ==
        ~replayBadId

end define;

fair process consumer = "consumer"
begin
    CheckFork:
        if ~forkValid then
            forkErr := TRUE;
            phase   := "ForkRejected";
            goto Terminate;
        end if;

    StartStreaming:
        phase := "Streaming";

    ConsumeLoop:
        while eventIndex <= Len(EventSeq) /\ ~adapterErr do
            curEv := EventSeq[eventIndex];
            if curEv.etype # ET_RESULT then
                newSidSeen := TRUE;
            end if;

            NormalizeStep:
                if curEv.etype = ET_RESULT then
                    streamDone := TRUE;
                    phase      := "Complete";
                    eventIndex := eventIndex + 1;
                elsif curEv.isReplay then
                    if curEv.euuid = "" then
                        replayBadId := TRUE;
                        nmMalformed := TRUE;
                        adapterErr  := TRUE;
                        phase       := "AdapterError";
                    else
                        eventIndex := eventIndex + 1;
                    end if;
                else
                    eventIndex := eventIndex + 1;
                end if;
        end while;

    Terminate:
        skip;
end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "4a05e0e4" /\ chksum(tla) = "e969d164")
VARIABLES pc, forkValid, eventIndex, curEv, newSidSeen, nmMalformed, 
          replayBadId, streamDone, adapterErr, forkErr, phase

(* define statement *)
StreamTerminates ==
    (forkValid /\ phase = "Complete") => streamDone

NewSessionIdObserved ==
    (forkValid /\ phase = "Complete") => newSidSeen

AdapterNeverFails ==
    forkValid => ~adapterErr

AdapterOutputWellFormed ==
    ~nmMalformed

ReplayIdentityPreserved ==
    ~replayBadId


vars == << pc, forkValid, eventIndex, curEv, newSidSeen, nmMalformed, 
           replayBadId, streamDone, adapterErr, forkErr, phase >>

ProcSet == {"consumer"}

Init == (* Global variables *)
        /\ forkValid \in {TRUE, FALSE}
        /\ eventIndex = 1
        /\ curEv = [etype |-> "", esid |-> "", isReplay |-> FALSE, euuid |-> ""]
        /\ newSidSeen = FALSE
        /\ nmMalformed = FALSE
        /\ replayBadId = FALSE
        /\ streamDone = FALSE
        /\ adapterErr = FALSE
        /\ forkErr = FALSE
        /\ phase = "Init"
        /\ pc = [self \in ProcSet |-> "CheckFork"]

CheckFork == /\ pc["consumer"] = "CheckFork"
             /\ IF ~forkValid
                   THEN /\ forkErr' = TRUE
                        /\ phase' = "ForkRejected"
                        /\ pc' = [pc EXCEPT !["consumer"] = "Terminate"]
                   ELSE /\ pc' = [pc EXCEPT !["consumer"] = "StartStreaming"]
                        /\ UNCHANGED << forkErr, phase >>
             /\ UNCHANGED << forkValid, eventIndex, curEv, newSidSeen, 
                             nmMalformed, replayBadId, streamDone, adapterErr >>

StartStreaming == /\ pc["consumer"] = "StartStreaming"
                  /\ phase' = "Streaming"
                  /\ pc' = [pc EXCEPT !["consumer"] = "ConsumeLoop"]
                  /\ UNCHANGED << forkValid, eventIndex, curEv, newSidSeen, 
                                  nmMalformed, replayBadId, streamDone, 
                                  adapterErr, forkErr >>

ConsumeLoop == /\ pc["consumer"] = "ConsumeLoop"
               /\ IF eventIndex <= Len(EventSeq) /\ ~adapterErr
                     THEN /\ curEv' = EventSeq[eventIndex]
                          /\ IF curEv'.etype # ET_RESULT
                                THEN /\ newSidSeen' = TRUE
                                ELSE /\ TRUE
                                     /\ UNCHANGED newSidSeen
                          /\ pc' = [pc EXCEPT !["consumer"] = "NormalizeStep"]
                     ELSE /\ pc' = [pc EXCEPT !["consumer"] = "Terminate"]
                          /\ UNCHANGED << curEv, newSidSeen >>
               /\ UNCHANGED << forkValid, eventIndex, nmMalformed, replayBadId, 
                               streamDone, adapterErr, forkErr, phase >>

NormalizeStep == /\ pc["consumer"] = "NormalizeStep"
                 /\ IF curEv.etype = ET_RESULT
                       THEN /\ streamDone' = TRUE
                            /\ phase' = "Complete"
                            /\ eventIndex' = eventIndex + 1
                            /\ UNCHANGED << nmMalformed, replayBadId, 
                                            adapterErr >>
                       ELSE /\ IF curEv.isReplay
                                  THEN /\ IF curEv.euuid = ""
                                             THEN /\ replayBadId' = TRUE
                                                  /\ nmMalformed' = TRUE
                                                  /\ adapterErr' = TRUE
                                                  /\ phase' = "AdapterError"
                                                  /\ UNCHANGED eventIndex
                                             ELSE /\ eventIndex' = eventIndex + 1
                                                  /\ UNCHANGED << nmMalformed, 
                                                                  replayBadId, 
                                                                  adapterErr, 
                                                                  phase >>
                                  ELSE /\ eventIndex' = eventIndex + 1
                                       /\ UNCHANGED << nmMalformed, 
                                                       replayBadId, adapterErr, 
                                                       phase >>
                            /\ UNCHANGED streamDone
                 /\ pc' = [pc EXCEPT !["consumer"] = "ConsumeLoop"]
                 /\ UNCHANGED << forkValid, curEv, newSidSeen, forkErr >>

Terminate == /\ pc["consumer"] = "Terminate"
             /\ TRUE
             /\ pc' = [pc EXCEPT !["consumer"] = "Done"]
             /\ UNCHANGED << forkValid, eventIndex, curEv, newSidSeen, 
                             nmMalformed, replayBadId, streamDone, adapterErr, 
                             forkErr, phase >>

consumer == CheckFork \/ StartStreaming \/ ConsumeLoop \/ NormalizeStep
               \/ Terminate

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == consumer
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(consumer)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 
====
