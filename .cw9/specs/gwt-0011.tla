---- MODULE ForkParentUnchanged ----
EXTENDS Integers, Sequences, TLC

P      == "session_parent"
NEW_ID == "session_new"
N      == 2

(*--algorithm ForkParentUnchanged

variables
  parentMerged     = << [msgId |-> 1], [msgId |-> 2], [msgId |-> 3] >>,
  preForkSnapshot  = << [msgId |-> 1], [msgId |-> 2], [msgId |-> 3] >>,
  newMerged        = <<>>,
  writesLog        = <<>>,
  phase            = "Idle",
  replayIndex      = 0,
  forkCommandValid \in {TRUE, FALSE};

define

  ParentMergedFrozen ==
    phase \in {"ForkDispatched", "SessionCreated", "Replaying", "NavigatedToNew"}
    => parentMerged = preForkSnapshot

  NoParentWrites ==
    \A i \in 1..Len(writesLog) : writesLog[i].sid # P

  NewSessionIsolated ==
    \A i \in 1..Len(writesLog) : writesLog[i].sid = NEW_ID

  ParentLengthPreserved ==
    Len(parentMerged) = 3

  ReplayTargetsNewSession ==
    phase = "NavigatedToNew" => Len(newMerged) = 2

  AllInvariants ==
    /\ ParentMergedFrozen
    /\ NoParentWrites
    /\ NewSessionIsolated
    /\ ParentLengthPreserved
    /\ ReplayTargetsNewSession

end define;

fair process forkLifecycle = "fork"
begin
  DispatchFork:
    if forkCommandValid then
      phase := "ForkDispatched";
    else
      phase := "ForkRejected";
    end if;

  CheckDispatch:
    if phase = "ForkRejected" then
      goto Terminate;
    end if;

  ReceiveSessionCreated:
    phase := "SessionCreated";

  ReplayFirst:
    newMerged   := Append(newMerged, [msgId |-> 1]);
    writesLog   := Append(writesLog, [sid |-> NEW_ID, op |-> "appendRealtime"]);
    replayIndex := replayIndex + 1;
    phase       := "Replaying";

  ReplaySecond:
    newMerged   := Append(newMerged, [msgId |-> 2]);
    writesLog   := Append(writesLog, [sid |-> NEW_ID, op |-> "appendRealtime"]);
    replayIndex := replayIndex + 1;

  NavigateToNew:
    phase := "NavigatedToNew";

  Terminate:
    skip;

end process;

end algorithm; *)
\* BEGIN TRANSLATION (chksum(pcal) = "7489568c" /\ chksum(tla) = "46b09674")
VARIABLES pc, parentMerged, preForkSnapshot, newMerged, writesLog, phase, 
          replayIndex, forkCommandValid

(* define statement *)
ParentMergedFrozen ==
  phase \in {"ForkDispatched", "SessionCreated", "Replaying", "NavigatedToNew"}
  => parentMerged = preForkSnapshot

NoParentWrites ==
  \A i \in 1..Len(writesLog) : writesLog[i].sid # P

NewSessionIsolated ==
  \A i \in 1..Len(writesLog) : writesLog[i].sid = NEW_ID

ParentLengthPreserved ==
  Len(parentMerged) = 3

ReplayTargetsNewSession ==
  phase = "NavigatedToNew" => Len(newMerged) = 2

AllInvariants ==
  /\ ParentMergedFrozen
  /\ NoParentWrites
  /\ NewSessionIsolated
  /\ ParentLengthPreserved
  /\ ReplayTargetsNewSession


vars == << pc, parentMerged, preForkSnapshot, newMerged, writesLog, phase, 
           replayIndex, forkCommandValid >>

ProcSet == {"fork"}

Init == (* Global variables *)
        /\ parentMerged = << [msgId |-> 1], [msgId |-> 2], [msgId |-> 3] >>
        /\ preForkSnapshot = << [msgId |-> 1], [msgId |-> 2], [msgId |-> 3] >>
        /\ newMerged = <<>>
        /\ writesLog = <<>>
        /\ phase = "Idle"
        /\ replayIndex = 0
        /\ forkCommandValid \in {TRUE, FALSE}
        /\ pc = [self \in ProcSet |-> "DispatchFork"]

DispatchFork == /\ pc["fork"] = "DispatchFork"
                /\ IF forkCommandValid
                      THEN /\ phase' = "ForkDispatched"
                      ELSE /\ phase' = "ForkRejected"
                /\ pc' = [pc EXCEPT !["fork"] = "CheckDispatch"]
                /\ UNCHANGED << parentMerged, preForkSnapshot, newMerged, 
                                writesLog, replayIndex, forkCommandValid >>

CheckDispatch == /\ pc["fork"] = "CheckDispatch"
                 /\ IF phase = "ForkRejected"
                       THEN /\ pc' = [pc EXCEPT !["fork"] = "Terminate"]
                       ELSE /\ pc' = [pc EXCEPT !["fork"] = "ReceiveSessionCreated"]
                 /\ UNCHANGED << parentMerged, preForkSnapshot, newMerged, 
                                 writesLog, phase, replayIndex, 
                                 forkCommandValid >>

ReceiveSessionCreated == /\ pc["fork"] = "ReceiveSessionCreated"
                         /\ phase' = "SessionCreated"
                         /\ pc' = [pc EXCEPT !["fork"] = "ReplayFirst"]
                         /\ UNCHANGED << parentMerged, preForkSnapshot, 
                                         newMerged, writesLog, replayIndex, 
                                         forkCommandValid >>

ReplayFirst == /\ pc["fork"] = "ReplayFirst"
               /\ newMerged' = Append(newMerged, [msgId |-> 1])
               /\ writesLog' = Append(writesLog, [sid |-> NEW_ID, op |-> "appendRealtime"])
               /\ replayIndex' = replayIndex + 1
               /\ phase' = "Replaying"
               /\ pc' = [pc EXCEPT !["fork"] = "ReplaySecond"]
               /\ UNCHANGED << parentMerged, preForkSnapshot, forkCommandValid >>

ReplaySecond == /\ pc["fork"] = "ReplaySecond"
                /\ newMerged' = Append(newMerged, [msgId |-> 2])
                /\ writesLog' = Append(writesLog, [sid |-> NEW_ID, op |-> "appendRealtime"])
                /\ replayIndex' = replayIndex + 1
                /\ pc' = [pc EXCEPT !["fork"] = "NavigateToNew"]
                /\ UNCHANGED << parentMerged, preForkSnapshot, phase, 
                                forkCommandValid >>

NavigateToNew == /\ pc["fork"] = "NavigateToNew"
                 /\ phase' = "NavigatedToNew"
                 /\ pc' = [pc EXCEPT !["fork"] = "Terminate"]
                 /\ UNCHANGED << parentMerged, preForkSnapshot, newMerged, 
                                 writesLog, replayIndex, forkCommandValid >>

Terminate == /\ pc["fork"] = "Terminate"
             /\ TRUE
             /\ pc' = [pc EXCEPT !["fork"] = "Done"]
             /\ UNCHANGED << parentMerged, preForkSnapshot, newMerged, 
                             writesLog, phase, replayIndex, forkCommandValid >>

forkLifecycle == DispatchFork \/ CheckDispatch \/ ReceiveSessionCreated
                    \/ ReplayFirst \/ ReplaySecond \/ NavigateToNew
                    \/ Terminate

(* Allow infinite stuttering to prevent deadlock on termination. *)
Terminating == /\ \A self \in ProcSet: pc[self] = "Done"
               /\ UNCHANGED vars

Next == forkLifecycle
           \/ Terminating

Spec == /\ Init /\ [][Next]_vars
        /\ WF_vars(forkLifecycle)

Termination == <>(\A self \in ProcSet: pc[self] = "Done")

\* END TRANSLATION 

\* CFG: INVARIANT ParentMergedFrozen
\* CFG: INVARIANT NoParentWrites
\* CFG: INVARIANT NewSessionIsolated
\* CFG: INVARIANT ParentLengthPreserved
\* CFG: INVARIANT ReplayTargetsNewSession
====
